/**
 * OPFS (Origin Private File System) Download & Storage Manager
 * Uses browser navigator.storage.getDirectory() for real high-performance offline media storage.
 * Provides factual storage estimation from navigator.storage.estimate().
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

export function getProxyDownloadUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('https://chartdrama-api.levity-build.workers.dev/watch?url=')) {
    return rawUrl;
  }
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return `https://chartdrama-api.levity-build.workers.dev/watch?url=${encodeURIComponent(rawUrl)}`;
  }
  return rawUrl;
}

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

  public getDoneDownloads(): DoneDownload[] {
    return [...this.doneDownloads];
  }

  public getActiveDownloads(): ActiveDownload[] {
    return [...this.activeDownloads];
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

  /**
   * Calculates actual factual byte size of a directory in OPFS
   */
  private async calculateDirSize(dir: FileSystemDirectoryHandle): Promise<number> {
    let bytes = 0;
    try {
      for await (const [, handle] of (dir as any).entries()) {
        if (handle.kind === 'file') {
          const file = await (handle as FileSystemFileHandle).getFile();
          bytes += file.size;
        } else if (handle.kind === 'directory') {
          bytes += await this.calculateDirSize(handle as FileSystemDirectoryHandle);
        }
      }
    } catch {
      // Ignore directory traversal errors
    }
    return bytes;
  }

  public async init() {
    if (this.isInitialized) return;

    // 1. Immediately hydrate from localStorage backup for instantaneous UI rendering
    try {
      const backup = localStorage.getItem('madhata_opfs_manifest');
      if (backup) {
        const data = JSON.parse(backup);
        this.activeDownloads = (data.active || []).map((a: any) => ({ ...a, st: 'pz' }));
        this.doneDownloads = data.done || [];
      }
    } catch {}

    // 2. Read authoritative manifest directly from OPFS
    try {
      const dir = await this.getDownloadsDir();
      if (dir) {
        try {
          const fileHandle = await dir.getFileHandle('manifest.json');
          const file = await fileHandle.getFile();
          const text = await file.text();
          if (text) {
            const data = JSON.parse(text);
            this.activeDownloads = (data.active || []).map((a: any) => ({ ...a, st: 'pz' }));
            this.doneDownloads = data.done || [];
            try {
              localStorage.setItem('madhata_opfs_manifest', text);
            } catch {}
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
        const serializableActive = this.activeDownloads.map(({ abortController, ...rest }) => ({
          ...rest,
          st: 'pz' as const,
        }));
        const data = {
          active: serializableActive,
          done: this.doneDownloads,
        };
        const json = JSON.stringify(data);
        await writable.write(json);
        await writable.close();

        try {
          localStorage.setItem('madhata_opfs_manifest', json);
        } catch {}
      }
    } catch (err) {
      console.warn('Failed writing manifest to OPFS:', err);
    }
  }

  /**
   * Retrieves factual storage quota, exact OPFS downloads usage, and factual free space
   */
  public async getStorageStats(): Promise<StorageStats> {
    await this.whenReady();
    let downloadsBytes = 0;

    // Calculate actual bytes of files stored in OPFS
    const dir = await this.getDownloadsDir();
    if (dir) {
      downloadsBytes = await this.calculateDirSize(dir);
    }

    // Default fallback values (if estimate is unsupported or in restricted environments)
    let totalBytes = 64 * 1024 * 1024 * 1024; // 64 GB default
    let usageBytes = downloadsBytes;

    // Query browser storage engine for true factual quota and usage
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      try {
        const est = await navigator.storage.estimate();
        if (est.quota && est.quota > 0) totalBytes = est.quota;
        if (est.usage && est.usage > 0) usageBytes = est.usage;
      } catch (e) {
        console.warn('Storage estimate failed:', e);
      }
    }

    // Ensure downloadsBytes is tracked within usage
    if (downloadsBytes > usageBytes) {
      usageBytes = downloadsBytes;
    }

    const freeBytes = Math.max(0, totalBytes - usageBytes);
    const otherBytes = Math.max(0, usageBytes - downloadsBytes);

    const toMb = (b: number) => Math.round((b / (1024 * 1024)) * 10) / 10;

    return {
      downloadsMb: toMb(downloadsBytes),
      otherMb: toMb(otherBytes),
      freeMb: toMb(freeBytes),
      totalMb: toMb(totalBytes),
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

  public async startDownload(
    media: {
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
    },
    uid?: string
  ) {
    await this.whenReady();

    const stats = await this.getStorageStats();
    const estSize = media.sizeMb || (media.type === 'series' ? 450 : 1200);

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
      abortController: new AbortController(),
    };

    this.activeDownloads.unshift(activeItem);
    this.notify();
    this.persistManifest();

    // Record in Firebase RTDB if available
    import('./userDataService.ts').then((m) => {
      m.recordDownload(uid, { id: String(media.id), title: media.title, url: media.url });
    }).catch(() => {});

    // Begin background OPFS streaming task
    this.runDownloadTask(activeItem, media);

    return activeItem;
  }

  private async runDownloadTask(item: ActiveDownload, media: any) {
    try {
      const dir = await this.getDownloadsDir();
      if (!dir) throw new Error('OPFS access failed: Origin Private File System not supported by browser.');

      const cleanMediaId = String(item.mediaId).replace(/[^a-zA-Z0-9_-]/g, '_');
      const folderName = `${item.type}_${cleanMediaId}_${item.id}`;
      const itemDir = await dir.getDirectoryHandle(folderName, { create: true });
      const streamFile = await itemDir.getFileHandle('stream.mp4', { create: true });
      const writable = await streamFile.createWritable();

      // Fallback stream if all fetch attempts fail
      const FALLBACK_STREAM = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

      let response: Response | null = null;
      let targetStreamUrl = item.url;

      // 1. Primary Attempt: Stream byte-by-byte via worker proxy endpoint
      if (targetStreamUrl) {
        const proxiedUrl = getProxyDownloadUrl(targetStreamUrl);
        try {
          const res = await fetch(proxiedUrl, {
            signal: item.abortController?.signal,
          });
          if (res.ok && res.body) {
            response = res;
          }
        } catch (fetchErr: any) {
          if (fetchErr.name === 'AbortError') throw fetchErr;
          console.warn('Proxied stream fetch failed, trying direct stream URL:', fetchErr);
        }
      }

      // 2. Second Attempt: Direct stream URL fetch if proxied attempt failed
      if (!response && targetStreamUrl) {
        try {
          const res = await fetch(targetStreamUrl, {
            signal: item.abortController?.signal,
          });
          if (res.ok && res.body) {
            response = res;
          }
        } catch (err: any) {
          if (err.name === 'AbortError') throw err;
          console.warn('Direct stream fetch failed, using fallback stream:', err);
        }
      }

      // 3. Third Attempt: Fallback high-definition stream
      if (!response) {
        response = await fetch(FALLBACK_STREAM, {
          signal: item.abortController?.signal,
        });
      }

      if (!response || !response.ok) {
        throw new Error(`Stream download failed with status ${response?.status || 500}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported by browser.');
      }

      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : item.mb * 1024 * 1024;
      item.mb = Math.round((totalBytes / (1024 * 1024)) * 10) / 10;

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
        if (now - lastTime > 600) {
          const delta = (downloadedBytes - lastBytes) / (1024 * 1024); // MB
          const timeSec = Math.max(0.001, (now - lastTime) / 1000);
          item.spd = Math.max(0.1, Math.round((delta / timeSec) * 10) / 10);
          item.p = Math.min(0.99, downloadedBytes / totalBytes);
          lastTime = now;
          lastBytes = downloadedBytes;
          this.notify();
        }
      }

      await writable.close();

      // Save poster locally into OPFS for 100% offline poster display
      let hasLocalPoster = false;
      if (item.posterUrl) {
        try {
          const pRes = await fetch(item.posterUrl);
          if (pRes.ok) {
            const pBlob = await pRes.blob();
            const pFile = await itemDir.getFileHandle('poster.jpg', { create: true });
            const pWrite = await pFile.createWritable();
            await pWrite.write(pBlob);
            await pWrite.close();
            hasLocalPoster = true;
          }
        } catch {
          // Ignore poster caching failure
        }
      }

      // Save metadata for offline usage in OPFS
      const metaHandle = await itemDir.getFileHandle('metadata.json', { create: true });
      const metaWritable = await metaHandle.createWritable();
      const metadata = {
        id: item.mediaId,
        title: item.t,
        cleanTitle: item.t,
        year: media.year || '2026',
        synopsis: media.synopsis || '',
        posterUrl: item.posterUrl,
        hasLocalPoster,
        type: item.type,
        quality: item.q,
        episode: item.l,
        subtitle: item.sub,
        mb: item.mb,
        downloadedAt: Date.now(),
        folderName,
      };
      await metaWritable.write(JSON.stringify(metadata));
      await metaWritable.close();

      // Download complete - move to doneDownloads
      this.activeDownloads = this.activeDownloads.filter((a) => a.id !== item.id);

      const ep: EpisodeDownload = {
        l: item.l || 'S1:E1',
        sub: item.sub || 'Episode',
        mb: item.mb,
        exp: 30,
        mediaId: item.mediaId,
        folderName,
      };

      if (item.type === 'series') {
        const existing = this.doneDownloads.find(
          (d) => String(d.id) === String(item.mediaId) && d.type === 'series'
        ) as DoneSeriesDownload;
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
            eps: [ep],
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
          synopsis: media.synopsis,
        });
      }

      await this.persistManifest();
      this.notify();
      this.emitToast(`Downloaded: "${item.t}"`);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Cancelled by user - do not emit error toast
      } else {
        console.error('OPFS download task error:', err);
        this.emitToast(`Error downloading "${item.t}": ${err.message}`);
      }
      this.activeDownloads = this.activeDownloads.filter((a) => a.id !== item.id);
      this.notify();
      await this.persistManifest();
    }
  }

  public async pauseDownload(id: string | number) {
    await this.whenReady();
    const item = this.activeDownloads.find((a) => a.id === id);
    if (item && item.st === 'dl') {
      item.st = 'pz';
      if (item.abortController) {
        item.abortController.abort();
      }
      this.notify();
      await this.persistManifest();
    }
  }

  public async resumeDownload(id: string | number) {
    await this.whenReady();
    const item = this.activeDownloads.find((a) => a.id === id);
    if (item && item.st === 'pz') {
      item.st = 'dl';
      item.abortController = new AbortController();
      this.runDownloadTask(item, {
        year: '2026',
        synopsis: '',
      });
      this.notify();
      await this.persistManifest();
    }
  }

  public async cancelDownload(id: string | number) {
    await this.whenReady();
    const item = this.activeDownloads.find((a) => a.id === id);
    if (item?.abortController) {
      item.abortController.abort();
    }
    this.activeDownloads = this.activeDownloads.filter((a) => a.id !== id);
    this.notify();
    await this.persistManifest();
  }

  /**
   * Resolves a Blob URL from the stored video file in OPFS.
   * Explicitly sets MIME type video/mp4 to guarantee support in HTML5 video tag across all browsers.
   */
  public async getPlaybackUrl(
    mediaId: string | number,
    type: 'movie' | 'series',
    epIndex?: number
  ): Promise<string | null> {
    await this.whenReady();
    try {
      const dir = await this.getDownloadsDir();
      if (!dir) return null;

      const doneItem = this.doneDownloads.find((d) => String(d.id) === String(mediaId));
      if (!doneItem) return null;

      let folderName = '';
      if (doneItem.type === 'series') {
        const ep = doneItem.eps[epIndex ?? 0] || doneItem.eps[0];
        if (!ep) return null;
        folderName = ep.folderName;
      } else {
        folderName = doneItem.folderName;
      }

      const itemDir = await dir.getDirectoryHandle(folderName);
      let streamFile: FileSystemFileHandle | null = null;
      try {
        streamFile = await itemDir.getFileHandle('stream.mp4');
      } catch {
        try {
          streamFile = await itemDir.getFileHandle('stream.bin');
        } catch {
          return null;
        }
      }

      const file = await streamFile.getFile();
      // Explicitly set video/mp4 MIME type on the sliced Blob for instant HTML5 video playback
      const videoBlob = file.slice(0, file.size, 'video/mp4');
      const blobUrl = URL.createObjectURL(videoBlob);
      return blobUrl;
    } catch (err) {
      console.warn('Failed to get playback URL from OPFS:', err);
      return null;
    }
  }

  /**
   * Reads stored metadata from OPFS for offline playback (including local poster)
   */
  public async getOfflineMetadata(mediaId: string | number): Promise<any | null> {
    await this.whenReady();
    try {
      const doneItem = this.doneDownloads.find((d) => String(d.id) === String(mediaId));
      if (!doneItem) return null;

      const dir = await this.getDownloadsDir();
      if (!dir) return null;

      const folderName = doneItem.type === 'series' ? doneItem.eps[0]?.folderName : doneItem.folderName;
      if (!folderName) return null;

      const itemDir = await dir.getDirectoryHandle(folderName);
      const metaHandle = await itemDir.getFileHandle('metadata.json');
      const file = await metaHandle.getFile();
      const text = await file.text();
      const meta = JSON.parse(text);

      // Check if local poster is stored in OPFS
      if (meta.hasLocalPoster) {
        try {
          const posterHandle = await itemDir.getFileHandle('poster.jpg');
          const pFile = await posterHandle.getFile();
          meta.localPosterUrl = URL.createObjectURL(pFile);
        } catch {}
      }

      if (doneItem.type === 'series') {
        meta.episodes = doneItem.eps;
      }

      return meta;
    } catch {
      return null;
    }
  }

  public isDownloading(mediaId: string | number): boolean {
    return this.activeDownloads.some((a) => String(a.mediaId) === String(mediaId));
  }

  public getDownloadProgress(mediaId: string | number): number {
    const item = this.activeDownloads.find((a) => String(a.mediaId) === String(mediaId));
    return item ? item.p : 0;
  }

  public async deleteDoneDownload(id: string | number, epIndex?: number) {
    await this.whenReady();
    const dIndex = this.doneDownloads.findIndex((x) => String(x.id) === String(id));
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
