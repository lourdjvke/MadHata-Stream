/**
 * IndexedDB Database Utility for storing playback progress and recently watched media
 */

export interface WatchedMedia {
  id: string;
  title: string;
  cleanTitle: string;
  poster: string;
  url: string;
  source: string;
  episodeIndex: number;
  progress: number; // 0 to 1
  duration?: number; // in seconds
  timestamp: number;
}

const DB_NAME = 'slothui_db';
const DB_VERSION = 1;
const STORE_RECENT = 'recent_watched';
const STORE_DURATIONS = 'media_durations';

class DatabaseService {
  private db: IDBDatabase | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_RECENT)) {
          db.createObjectStore(STORE_RECENT, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_DURATIONS)) {
          db.createObjectStore(STORE_DURATIONS, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  /**
   * Save or update recently watched media
   */
  async saveRecent(media: WatchedMedia): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(STORE_RECENT, 'readwrite');
    const store = tx.objectStore(STORE_RECENT);
    
    return new Promise((resolve, reject) => {
      const request = store.put(media);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all recently watched media, sorted by timestamp descending
   */
  async getRecentList(limit = 20): Promise<WatchedMedia[]> {
    const db = await this.getDB();
    const tx = db.transaction(STORE_RECENT, 'readonly');
    const store = tx.objectStore(STORE_RECENT);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const results = (request.result as WatchedMedia[]).sort((a, b) => b.timestamp - a.timestamp);
        resolve(results.slice(0, limit));
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save duration for a specific video URL or ID
   */
  async saveDuration(id: string, duration: number): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(STORE_DURATIONS, 'readwrite');
    const store = tx.objectStore(STORE_DURATIONS);
    
    return new Promise((resolve, reject) => {
      const request = store.put({ id, duration });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get duration for a specific video URL or ID
   */
  async getDuration(id: string): Promise<number | null> {
    const db = await this.getDB();
    const tx = db.transaction(STORE_DURATIONS, 'readonly');
    const store = tx.objectStore(STORE_DURATIONS);
    
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result?.duration || null);
      request.onerror = () => reject(request.error);
    });
  }
}

export const dbService = new DatabaseService();
