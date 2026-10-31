/**
 * OPFS (Origin Private File System) Download & Storage Manager
 * Uses browser navigator.storage.getDirectory() for real high-performance offline media storage.
 */

export interface ActiveDownload {
  id: string | number;
  t: string; // Title
  l?: string; // Label (e.g. S1:E5)
  sub: string; // Subtitle or "Movie"
  mb: number; // Size in MB
  p: number; // Progress (0 to 1)
  st: 'dl' | 'pz'; // Downloading or Paused
  spd: number; // Speed in MB/s
  q: string; // Quality (HD, 4K)
  k: number; // Thumbnail color key
  posterUrl?: string;
  mediaId: string | number;
  type: 'movie' | 'series';
  abortController?: AbortController;
  url: string;
}

export interface EpisodeDownload {
  l: string; // e.g. "S1:E1"
  sub: string; // Episode name
  mb: number;
  exp: number; // Days until expiration
  mediaId: string | number;
  folderName: string;
}

export interface DoneSeriesDownload {
  id: string | number; // This is the mediaId
  type: 'series';
  t: string;
  q: string;
  k: number;
  posterUrl?: string;
  eps: EpisodeDownload[];
  year?: string;
  synopsis?: string;
}

export interface DoneMovieDownload {
  id: string | number; // This is the mediaId
  type: 'movie';
  t: string;
  sub: string;
  mb: number;
  exp: number;
  q: string;
  k: number;
  posterUrl?: string;
  folderName: string;
  year?: string;
  synopsis?: string;
}

export type DoneDownload = DoneSeriesDownload | DoneMovieDownload;

export interface StorageStats {
  downloadsMb: number;
  otherMb: number;
  freeMb: number;
  totalMb: number;
}

type StorageListener = (active: ActiveDownload[], done: DoneDownload[], stats: StorageStats) => void;

class OPFSService {
  private activeDownloads: ActiveDownload[] = [];
  private doneDownloads: DoneDownload[] = [];
  private listeners: Set<StorageListener> = new Set();
  private toastListeners: Set<(msg: string) => void> = new Set();
  private isInitialized = false;
  private readyPromise: Promise<void>;

  constructor() {
    this.readyPromise = this.init();
  }

  public async whenReady(): Promise<void> {
    return this.readyPromise;
  }

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory;
  }

  private async getDownloadsDir(): Promise<FileSystemDirectoryHandle | null> {
    if (!this.isSupported()) return null;
    try {
      const root = await navigator.storage.getDirectory();
      return await root.getDirectoryHandle('madhata_downloads', { create: true });
    } catch (err) {
      console.warn('OPFS getDirectory handle failed:', err);
      return null;
    }
  }

  public async init() {
    if (this.isInitialized) return;

    try {
      const dir = await this.getDownloadsDir();
      if (dir) {
        try {
          const fileHandle = await dir.getFileHandle('manifest.json');
          const file = await fileHandle.getFile();
          const text = await file.text();
          if (text) {
            const data = JSON.parse(text);
            // Abort controllers cannot be serialized, so they stay undefined/null on reload
            this.activeDownloads = (data.active || []).map((a: any) => ({ ...a, st: 'pz' }));
            this.doneDownloads = data.done || [];
          }
        } catch {
          // File doesn't exist yet
        }
      }
    } catch (err) {
      console.warn('Failed to initialize OPFS storage manifest:', err);
    }

    this.isInitialized = true;
    this.notify();
  }

  private async persistManifest() {
    try {
      const dir = await this.getDownloadsDir();
      if (dir) {
        const fileHandle = await dir.getFileHandle('manifest.json', { create: true });
        const writable = await fileHandle.createWritable();
        // Remove non-serializable fields before saving
        const serializableActive = this.activeDownloads.map(({ abortController, ...rest }) => ({ ...rest, st: 'pz' }));
        const json = JSON.stringify({
          active: serializableActive,
          done: this.doneDownloads,
        });
        await writable.write(json);
        await writable.close();
      }
    } catch (err) {
      console.warn('Failed writing manifest to OPFS:', err);
    }
  }

  public async getStorageStats(): Promise<StorageStats> {
    await this.whenReady();
    const DEFAULT_TOTAL = 64 * 1024;
    const DEFAULT_OTHER = 38.4 * 1024;

    let downloadsMb = 0;
    this.doneDownloads.forEach((d) => {
      if (d.type === 'series') {
        downloadsMb += d.eps.reduce((acc, ep) => acc + ep.mb, 0);
      } else {
        downloadsMb += d.mb;
      }
    });
    this.activeDownloads.forEach((a) => {
      downloadsMb += a.mb * a.p;
    });

    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      try {
        const est = await navigator.storage.estimate();
        const quotaMb = est.quota ? est.quota / (1024 * 1024) : DEFAULT_TOTAL;
        const usageMb = est.usage ? est.usage / (1024 * 1024) : DEFAULT_OTHER;
        const otherMb = Math.max(0, usageMb - downloadsMb);
        const freeMb = Math.max(0, quotaMb - usageMb);

        return {
          downloadsMb: Math.round(downloadsMb * 10) / 10,
          otherMb: Math.round(otherMb * 10) / 10,
          freeMb: Math.round(freeMb * 10) / 10,
          totalMb: Math.round(quotaMb * 10) / 10,
        };
      } catch (e) {
        console.warn('Storage estimate failed:', e);
      }
    }

    return {
      downloadsMb: Math.round(downloadsMb * 10) / 10,
      otherMb: DEFAULT_OTHER,
      freeMb: Math.round((DEFAULT_TOTAL - DEFAULT_OTHER - downloadsMb) * 10) / 10,
      totalMb: DEFAULT_TOTAL,
    };
  }

  public subscribe(listener: StorageListener) {
    this.listeners.add(listener);
    this.notify();
    return () => {
      this.listeners.delete(listener);
    };
  }

  public subscribeToast(fn: (msg: string) => void) {
    this.toastListeners.add(fn);
    return () => {
      this.toastListeners.delete(fn);
    };
  }

  private emitToast(msg: string) {
    this.toastListeners.forEach((fn) => fn(msg));
  }

  private async notify() {
    const stats = await this.getStorageStats();
    this.listeners.forEach((fn) => fn([...this.activeDownloads], [...this.doneDownloads], stats));
  }

  public async startDownload(media: {
    id: string | number;
    title: string;
    type: 'movie' | 'series';
    url: string;
    quality?: string;
    posterUrl?: string;
    sub?: string;
    label?: string;
    sizeMb?: number;
    k?: number;
    year?: string;
    synopsis?: string;
  }, uid?: string) {
    await this.whenReady();
    if (!media.url) throw new Error('No download URL provided.');

    const stats = await this.getStorageStats();
    // Use content-length if possible, but for start let's assume size
    const estSize = media.sizeMb || (media.type === 'series' ? 650 : 1500);

    if (stats.freeMb < estSize) {
      throw new Error(`Insufficient storage! Need ${estSize.toFixed(1)} MB, but only ${stats.freeMb.toFixed(1)} MB free.`);
    }

    const newId = Date.now();
    const activeItem: ActiveDownload = {
      id: newId,
      mediaId: media.id,
      t: media.title,
      l: media.label || '',
      sub: media.sub || (media.type === 'series' ? 'Episode' : 'Movie'),
      mb: estSize,
      p: 0,
      st: 'dl',
      spd: 0,
      q: media.quality || 'HD',
      k: media.k ?? Math.floor(Math.random() * 8),
      posterUrl: media.posterUrl,
      type: media.type,
      url: media.url,
      abortController: new AbortController()
    };

    this.activeDownloads.unshift(activeItem);
    this.notify();
    this.persistManifest();

    // Record in Firebase RTDB
    import('./userDataService.ts').then(m => {
      m.recordDownload(uid, { id: String(media.id), title: media.title, url: media.url });
    });

    // Actual background fetching logic
    this.runDownloadTask(activeItem, media);

    return activeItem;
  }

  private async runDownloadTask(item: ActiveDownload, media: any) {
    try {
      const response = await fetch(item.url, { signal: item.abortController?.signal });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      if (!response.body) throw new Error('ReadableStream not supported.');

      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : item.mb * 1024 * 1024;
      item.mb = Math.round(totalBytes / (1024 * 1024) * 10) / 10;

      const dir = await this.getDownloadsDir();
      if (!dir) throw new Error('OPFS access failed.');

      const folderName = `${item.type}_${item.mediaId}_${item.id}`;
      const itemDir = await dir.getDirectoryHandle(folderName, { create: true });
      const streamFile = await itemDir.getFileHandle('stream.bin', { create: true });
      const writable = await streamFile.createWritable();

      const reader = response.body.getReader();
      let downloadedBytes = 0;
      let lastTime = performance.now();
      let lastBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        await writable.write(value);
        downloadedBytes += value.length;

        const now = performance.now();
        if (now - lastTime > 1000) {
          const delta = (downloadedBytes - lastBytes) / (1024 * 1024); // MB
          item.spd = Math.round(delta * 10) / 10;
          item.p = downloadedBytes / totalBytes;
          lastTime = now;
          lastBytes = downloadedBytes;
          this.notify();
        }
      }

      await writable.close();
      
      // Save metadata for offline usage
      const metaHandle = await itemDir.getFileHandle('metadata.json', { create: true });
      const metaWritable = await metaHandle.createWritable();
      const metadata = {
        id: item.mediaId,
        title: item.t,
        year: media.year || '2026',
        synopsis: media.synopsis || '',
        posterUrl: item.posterUrl,
        type: item.type,
        quality: item.q,
        episode: item.l,
        subtitle: item.sub,
        mb: item.mb,
        downloadedAt: Date.now()
      };
      await metaWritable.write(JSON.stringify(metadata));
      await metaWritable.close();

      // Download complete - move to done
      this.activeDownloads = this.activeDownloads.filter(a => a.id !== item.id);
      
      const ep: EpisodeDownload = {
        l: item.l || 'S1:E1',
        sub: item.sub || 'Episode',
        mb: item.mb,
        exp: 30,
        mediaId: item.mediaId,
        folderName
      };

      if (item.type === 'series') {
        const existing = this.doneDownloads.find(d => String(d.id) === String(item.mediaId) && d.type === 'series') as DoneSeriesDownload;
        if (existing) {
          existing.eps.push(ep);
        } else {
          this.doneDownloads.unshift({
            id: item.mediaId,
            type: 'series',
            t: item.t,
            q: item.q,
            k: item.k,
            posterUrl: item.posterUrl,
            year: media.year,
            synopsis: media.synopsis,
            eps: [ep]
          });
        }
      } else {
        this.doneDownloads.unshift({
          id: item.mediaId,
          type: 'movie',
          t: item.t,
          sub: item.sub,
          mb: item.mb,
          exp: 30,
          q: item.q,
          k: item.k,
          posterUrl: item.posterUrl,
          folderName,
          year: media.year,
          synopsis: media.synopsis
        });
      }

      this.persistManifest();
      this.notify();
      this.emitToast(`Downloaded: "${item.t}"`);

    } catch (err: any) {
      if (err.name === 'AbortError') {
        // No toast for cancellation as requested
      } else {
        console.error('Download task failed:', err);
        this.emitToast(`Error downloading "${item.t}": ${err.message}`);
      }
      this.activeDownloads = this.activeDownloads.filter(a => a.id !== item.id);
      this.notify();
      this.persistManifest();
    }
  }

  public async pauseDownload(id: string | number) {
    await this.whenReady();
    const item = this.activeDownloads.find(a => a.id === id);
    if (item && item.st === 'dl') {
      item.st = 'pz';
      if (item.abortController) {
        item.abortController.abort();
      }
      this.notify();
      this.persistManifest();
    }
  }

  public async resumeDownload(id: string | number) {
    await this.whenReady();
    const item = this.activeDownloads.find(a => a.id === id);
    if (item && item.st === 'pz') {
      item.st = 'dl';
      item.abortController = new AbortController();
      // Re-run task
      this.runDownloadTask(item, {
        year: '2026',
        synopsis: ''
      });
      this.notify();
      this.persistManifest();
    }
  }

  public async cancelDownload(id: string | number) {
    await this.whenReady();
    const item = this.activeDownloads.find(a => a.id === id);
    if (item?.abortController) {
      item.abortController.abort();
    }
    this.activeDownloads = this.activeDownloads.filter(a => a.id !== id);
    this.notify();
    this.persistManifest();
  }

  public async getPlaybackUrl(mediaId: string | number, type: 'movie' | 'series', epIndex?: number): Promise<string | null> {
    await this.whenReady();
    try {
      const dir = await this.getDownloadsDir();
      if (!dir) return null;

      const doneItem = this.doneDownloads.find(d => String(d.id) === String(mediaId));
      if (!doneItem) return null;

      let folderName = '';
      if (doneItem.type === 'series') {
        const ep = doneItem.eps[epIndex ?? 0];
        if (!ep) return null;
        folderName = ep.folderName;
      } else {
        folderName = doneItem.folderName;
      }

      try {
        const itemDir = await dir.getDirectoryHandle(folderName);
        const streamFile = await itemDir.getFileHandle('stream.bin');
        const file = await streamFile.getFile();
        return URL.createObjectURL(file);
      } catch (e) {
        console.warn('Could not find stream.bin in folder:', folderName, e);
        return null;
      }
    } catch (err) {
      console.warn('Failed to get playback URL from OPFS:', err);
      return null;
    }
  }

  public async getOfflineMetadata(mediaId: string | number): Promise<any | null> {
    await this.whenReady();
    try {
      const doneItem = this.doneDownloads.find(d => String(d.id) === String(mediaId));
      if (!doneItem) return null;

      const dir = await this.getDownloadsDir();
      if (!dir) return null;

      const folderName = doneItem.type === 'series' ? doneItem.eps[0].folderName : doneItem.folderName;
      const itemDir = await dir.getDirectoryHandle(folderName);
      const metaHandle = await itemDir.getFileHandle('metadata.json');
      const file = await metaHandle.getFile();
      const text = await file.text();
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  public isDownloading(mediaId: string | number): boolean {
    return this.activeDownloads.some(a => String(a.mediaId) === String(mediaId));
  }

  public getDownloadProgress(mediaId: string | number): number {
    const item = this.activeDownloads.find(a => String(a.mediaId) === String(mediaId));
    return item ? item.p : 0;
  }

  public async deleteDoneDownload(id: string | number, epIndex?: number) {
    await this.whenReady();
    const dIndex = this.doneDownloads.findIndex((x) => x.id === id);
    if (dIndex === -1) return;

    const target = this.doneDownloads[dIndex];
    let folderToDelete = '';

    if (target.type === 'series' && epIndex !== undefined && target.eps.length > 1) {
      folderToDelete = target.eps[epIndex].folderName;
      target.eps.splice(epIndex, 1);
    } else {
      if (target.type === 'series') {
        for (const ep of target.eps) {
           await this.deleteOpfsFolder(ep.folderName);
        }
      } else {
        folderToDelete = target.folderName;
      }
      this.doneDownloads.splice(dIndex, 1);
    }

    if (folderToDelete) {
      await this.deleteOpfsFolder(folderToDelete);
    }

    await this.persistManifest();
    this.notify();
  }

  private async deleteOpfsFolder(name: string) {
    try {
      const dir = await this.getDownloadsDir();
      if (dir) {
        await dir.removeEntry(name, { recursive: true });
      }
    } catch {}
  }

  public async deleteAllDoneDownloads() {
    await this.whenReady();
    for (const d of this.doneDownloads) {
      if (d.type === 'series') {
        for (const ep of d.eps) await this.deleteOpfsFolder(ep.folderName);
      } else {
        await this.deleteOpfsFolder(d.folderName);
      }
    }
    this.doneDownloads = [];
    await this.persistManifest();
    this.notify();
  }

  public restoreSnapshot(activeSnap: ActiveDownload[], doneSnap: DoneDownload[]) {
    this.activeDownloads = activeSnap;
    this.doneDownloads = doneSnap;
    this.persistManifest();
    this.notify();
  }
}

export const opfsService = new OPFSService();
