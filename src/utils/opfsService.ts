/**
 * OPFS (Origin Private File System) Download & Storage Manager
 * Uses browser navigator.storage.getDirectory() for high-performance offline media storage.
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
  mediaId?: string | number;
  type?: 'movie' | 'series';
}

export interface EpisodeDownload {
  l: string; // e.g. "S1:E1"
  sub: string; // Episode name
  mb: number;
  exp: number; // Days until expiration
  mediaId?: string | number;
  streamPath?: string;
}

export interface DoneSeriesDownload {
  id: string | number;
  type: 'series';
  t: string;
  q: string;
  k: number;
  posterUrl?: string;
  eps: EpisodeDownload[];
}

export interface DoneMovieDownload {
  id: string | number;
  type: 'movie';
  t: string;
  sub: string;
  mb: number;
  exp: number;
  q: string;
  k: number;
  posterUrl?: string;
  streamPath?: string;
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
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private isInitialized = false;

  public subscribeToast(fn: (msg: string) => void) {
    this.toastListeners.add(fn);
    return () => {
      this.toastListeners.delete(fn);
    };
  }

  public emitToast(msg: string) {
    this.toastListeners.forEach((fn) => fn(msg));
  }

  constructor() {
    this.init();
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
    this.isInitialized = true;

    try {
      const dir = await this.getDownloadsDir();
      if (dir) {
        try {
          const fileHandle = await dir.getFileHandle('manifest.json');
          const file = await fileHandle.getFile();
          const text = await file.text();
          if (text) {
            const data = JSON.parse(text);
            this.activeDownloads = data.active || [];
            this.doneDownloads = data.done || [];
          }
        } catch {
          // File doesn't exist yet
        }
      }
    } catch (err) {
      console.warn('Failed to initialize OPFS storage manifest:', err);
    }

    this.startProgressTicker();
    this.notify();
  }

  private async persistManifest() {
    try {
      const dir = await this.getDownloadsDir();
      if (dir) {
        const fileHandle = await dir.getFileHandle('manifest.json', { create: true });
        // Access writable stream or FileSystemWritableFileStream
        const writable = await fileHandle.createWritable();
        const json = JSON.stringify({
          active: this.activeDownloads,
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
    const DEFAULT_TOTAL = 64 * 1024; // 64 GB
    const DEFAULT_OTHER = 38.4 * 1024; // 38.4 GB

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

  private async notify() {
    const stats = await this.getStorageStats();
    this.listeners.forEach((fn) => fn([...this.activeDownloads], [...this.doneDownloads], stats));
  }

  public async startDownload(media: {
    id: string | number;
    title: string;
    type?: 'movie' | 'series';
    quality?: string;
    posterUrl?: string;
    sub?: string;
    label?: string;
    sizeMb?: number;
    k?: number;
  }) {
    const stats = await this.getStorageStats();
    const estSize = media.sizeMb || (media.type === 'series' ? 650 : 1500);

    // Check available space
    if (stats.freeMb < estSize / 1024 + 10) {
      throw new Error(`Storage limit exceeded! Free space (${stats.freeMb.toFixed(1)} MB) is lower than required size (${estSize} MB).`);
    }

    const newId = Date.now();
    const k = media.k ?? Math.floor(Math.random() * 8);

    const activeItem: ActiveDownload = {
      id: newId,
      t: media.title,
      l: media.label || (media.type === 'series' ? 'S1:E1' : ''),
      sub: media.sub || (media.type === 'series' ? 'Episode 1' : 'Movie'),
      mb: estSize,
      p: 0.05,
      st: 'dl',
      spd: Math.floor(Math.random() * 10) + 15, // 15-25 MB/s
      q: media.quality || 'HD',
      k,
      posterUrl: media.posterUrl,
      mediaId: media.id,
      type: media.type || 'movie',
    };

    this.activeDownloads.unshift(activeItem);
    await this.persistManifest();

    this.emitToast(`Downloading "${media.title}" in background. View progress in Downloads tab.`);

    // Create OPFS storage file placeholder for the media stream
    try {
      const dir = await this.getDownloadsDir();
      if (dir) {
        const folderName = `${media.type || 'movie'}_${media.id}_${newId}`;
        const itemDir = await dir.getDirectoryHandle(folderName, { create: true });
        const streamFile = await itemDir.getFileHandle('stream.bin', { create: true });
        const writable = await streamFile.createWritable();
        // Write initial chunk buffer
        const headerText = new TextEncoder().encode(`MADHATA_MEDIA_STREAM:${media.title}:${activeItem.sub}`);
        await writable.write(headerText);
        await writable.close();
      }
    } catch (e) {
      console.warn('OPFS file creation handle error:', e);
    }

    this.notify();
    return activeItem;
  }

  public async pauseDownload(id: string | number) {
    const item = this.activeDownloads.find((x) => x.id === id);
    if (item) {
      item.st = 'pz';
      await this.persistManifest();
      this.notify();
    }
  }

  public async resumeDownload(id: string | number) {
    const item = this.activeDownloads.find((x) => x.id === id);
    if (item) {
      item.st = 'dl';
      await this.persistManifest();
      this.notify();
    }
  }

  public async cancelDownload(id: string | number) {
    this.activeDownloads = this.activeDownloads.filter((x) => x.id !== id);
    await this.persistManifest();
    this.notify();
  }

  public async deleteDoneDownload(id: string | number, epIndex?: number) {
    const dIndex = this.doneDownloads.findIndex((x) => x.id === id);
    if (dIndex === -1) return;

    const target = this.doneDownloads[dIndex];
    if (target.type === 'series' && epIndex !== undefined && target.eps.length > 1) {
      target.eps.splice(epIndex, 1);
    } else {
      this.doneDownloads.splice(dIndex, 1);

      // Clean up OPFS folder
      try {
        const dir = await this.getDownloadsDir();
        if (dir) {
          const folderName = `${target.type}_${target.id}`;
          try {
            await dir.removeEntry(folderName, { recursive: true });
          } catch {
            // Folder might not exist
          }
        }
      } catch (err) {
        console.warn('Error removing OPFS folder:', err);
      }
    }

    await this.persistManifest();
    this.notify();
  }

  public async deleteAllDoneDownloads() {
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

  public async getPlaybackUrl(id: string | number, type: 'movie' | 'series', epIndex?: number): Promise<string | null> {
    try {
      const dir = await this.getDownloadsDir();
      if (!dir) return null;

      const doneItem = this.doneDownloads.find(d => d.id === id);
      if (!doneItem) return null;

      let folderName = '';
      if (type === 'series' && doneItem.type === 'series') {
        folderName = `series_${id}`;
      } else {
        folderName = `movie_${id}`;
      }

      // In this simulated environment, we might just return the original URL if we didn't actually download 100% of bytes
      // But for "offline" demo, we need to show we can get a Blob from OPFS.
      try {
        const itemDir = await dir.getDirectoryHandle(folderName);
        const streamFile = await itemDir.getFileHandle('stream.bin');
        const file = await streamFile.getFile();
        return URL.createObjectURL(file);
      } catch {
        return null;
      }
    } catch (err) {
      console.warn('Failed to get playback URL from OPFS:', err);
      return null;
    }
  }

  public isDownloading(mediaId: string | number): boolean {
    return this.activeDownloads.some(a => a.mediaId === mediaId);
  }

  public getDownloadProgress(mediaId: string | number): number {
    const item = this.activeDownloads.find(a => a.mediaId === mediaId);
    return item ? item.p : 0;
  }

  private startProgressTicker() {
    if (this.intervalTimer) return;
    this.intervalTimer = setInterval(() => {
      let changed = false;
      let finishedItem: ActiveDownload | null = null;

      this.activeDownloads.forEach((a) => {
        if (a.st !== 'dl') return;
        // Simulate download speed: increase progress
        a.p = Math.min(1, a.p + (a.spd * 0.5) / a.mb);
        changed = true;
        if (a.p >= 1 && !finishedItem) {
          finishedItem = a;
        }
      });

      if (finishedItem) {
        const a: ActiveDownload = finishedItem;
        this.activeDownloads = this.activeDownloads.filter((x) => x.id !== a.id);

        const ep: EpisodeDownload = {
          l: a.l || 'S1:E1',
          sub: a.sub || 'Episode',
          mb: a.mb,
          exp: 30,
          mediaId: a.mediaId
        };

        if (a.type === 'series' || a.l) {
          const existingSeries = this.doneDownloads.find(
            (x) => x.type === 'series' && x.t === a.t
          ) as DoneSeriesDownload | undefined;

          if (existingSeries) {
            existingSeries.eps.push(ep);
          } else {
            const newSeries: DoneSeriesDownload = {
              id: a.mediaId || Date.now(),
              type: 'series',
              t: a.t,
              q: a.q,
              k: a.k,
              posterUrl: a.posterUrl,
              eps: [ep],
            };
            this.doneDownloads.unshift(newSeries);
          }
        } else {
          const newMovie: DoneMovieDownload = {
            id: a.mediaId || Date.now(),
            type: 'movie',
            t: a.t,
            sub: a.sub || 'Movie',
            mb: a.mb,
            exp: 30,
            q: a.q,
            k: a.k,
            posterUrl: a.posterUrl,
          };
          this.doneDownloads.unshift(newMovie);
        }

        this.persistManifest();
      }

      if (changed) {
        this.notify();
      }
    }, 500);
  }
}

export const opfsService = new OPFSService();
