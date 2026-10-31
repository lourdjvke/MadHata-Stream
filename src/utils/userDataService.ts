import { ref, set, get, remove, onValue, update } from 'firebase/database';
import { rtdb } from '../firebase.ts';

export interface WatchlistItem {
  id: string;
  title: string;
  poster?: string;
  url: string;
  source?: string;
  year?: string;
  type?: string;
  rating?: string;
  addedAt: number;
}

export interface HistoryItem {
  id: string;
  title: string;
  poster?: string;
  url: string;
  source?: string;
  label: string; // e.g. 'S1:E2' or 'Movie'
  duration: number; // in minutes
  progress: number; // 0 to 1
  watchedAt: number;
  group?: string; // 'Today' | 'Yesterday' | 'Earlier this week' | 'This month'
}

export interface UserStats {
  totalWatchMinutes: number;
  totalTitlesWatched: number;
  totalWatchlistCount: number;
  totalDownloads: number;
  totalVisitDays?: number;
  lastUpdated: number;
  lastVisitAt?: number;
}

// Clean key for RTDB paths
export const cleanMediaKey = (key: string): string => {
  return encodeURIComponent(key).replace(/\./g, '%2E').replace(/#/g, '%23').replace(/\$/g, '%24').replace(/\[/g, '%5B').replace(/\]/g, '%5D');
};

// Calculate relative group based on timestamp
export const calculateDateGroup = (timestamp: number): string => {
  const now = new Date();
  const d = new Date(timestamp);
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0 && now.getDate() === d.getDate()) return 'Today';
  if (diffDays <= 1 || (now.getDate() - d.getDate() === 1 && now.getMonth() === d.getMonth())) return 'Yesterday';
  if (diffDays <= 7) return 'Earlier this week';
  if (diffDays <= 30) return 'This month';
  return 'Earlier';
};

// --- Watchlist functions ---

export const addToWatchlist = async (uid: string, item: Omit<WatchlistItem, 'addedAt'>): Promise<void> => {
  if (!uid || !item.id) return;
  const key = cleanMediaKey(item.id);
  const watchlistItem: WatchlistItem = {
    ...item,
    addedAt: Date.now(),
  };

  try {
    const itemRef = ref(rtdb, `users/${uid}/watchlist/${key}`);
    await set(itemRef, watchlistItem);
    // Also save in localStorage cache for instant UI rendering
    localStorage.setItem(`madhata_wl_${key}`, JSON.stringify(watchlistItem));
  } catch (err) {
    console.error('Error adding to watchlist in RTDB:', err);
    localStorage.setItem(`madhata_wl_${key}`, JSON.stringify(watchlistItem));
  }
};

export const removeFromWatchlist = async (uid: string, mediaId: string): Promise<void> => {
  if (!uid || !mediaId) return;
  const key = cleanMediaKey(mediaId);
  try {
    const itemRef = ref(rtdb, `users/${uid}/watchlist/${key}`);
    await remove(itemRef);
    localStorage.removeItem(`madhata_wl_${key}`);
  } catch (err) {
    console.error('Error removing from watchlist in RTDB:', err);
    localStorage.removeItem(`madhata_wl_${key}`);
  }
};

export const isMediaInWatchlist = async (uid: string, mediaId: string): Promise<boolean> => {
  if (!mediaId) return false;
  const key = cleanMediaKey(mediaId);
  // Check local cache first
  if (localStorage.getItem(`madhata_wl_${key}`)) return true;
  if (!uid) return false;

  try {
    const itemRef = ref(rtdb, `users/${uid}/watchlist/${key}`);
    const snap = await get(itemRef);
    return snap.exists();
  } catch {
    return false;
  }
};

export const getWatchlist = async (uid: string): Promise<WatchlistItem[]> => {
  if (!uid) return [];
  try {
    const listRef = ref(rtdb, `users/${uid}/watchlist`);
    const snap = await get(listRef);
    if (!snap.exists()) return [];
    const val = snap.val();
    return Object.values(val) as WatchlistItem[];
  } catch (err) {
    console.error('Error fetching watchlist from RTDB:', err);
    return [];
  }
};

export const listenToWatchlist = (uid: string, callback: (items: WatchlistItem[]) => void): (() => void) => {
  if (!uid) return () => {};
  const listRef = ref(rtdb, `users/${uid}/watchlist`);
  return onValue(listRef, (snap) => {
    if (!snap.exists()) {
      callback([]);
      return;
    }
    const val = snap.val();
    const items = Object.values(val) as WatchlistItem[];
    // Sort descending by addedAt
    items.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    callback(items);
  });
};

// --- Watch history & progress functions ---

export const saveWatchProgress = async (uid: string, item: Omit<HistoryItem, 'watchedAt' | 'group'>): Promise<void> => {
  if (!uid || !item.id) return;
  const key = cleanMediaKey(item.id);
  const now = Date.now();
  const historyItem: HistoryItem = {
    ...item,
    watchedAt: now,
    group: calculateDateGroup(now),
  };

  try {
    const histRef = ref(rtdb, `users/${uid}/history/${key}`);
    await set(histRef, historyItem);

    // Update total watch stats
    const statsRef = ref(rtdb, `users/${uid}/stats`);
    const snap = await get(statsRef);
    let totalMinutes = 0;
    let totalTitles = 0;
    if (snap.exists()) {
      const currentStats = snap.val();
      totalMinutes = currentStats.totalWatchMinutes || 0;
      totalTitles = currentStats.totalTitlesWatched || 0;
    }
    // Increment watched minutes
    const addedMinutes = Math.round(item.duration * item.progress);
    await update(statsRef, {
      totalWatchMinutes: totalMinutes + Math.max(1, addedMinutes),
      lastUpdated: now,
    });
  } catch (err) {
    console.error('Error saving watch progress to RTDB:', err);
  }
};

export const removeFromHistory = async (uid: string, mediaId: string): Promise<void> => {
  if (!uid || !mediaId) return;
  const key = cleanMediaKey(mediaId);
  try {
    const itemRef = ref(rtdb, `users/${uid}/history/${key}`);
    await remove(itemRef);
  } catch (err) {
    console.error('Error removing history from RTDB:', err);
  }
};

export const clearWatchHistory = async (uid: string): Promise<void> => {
  if (!uid) return;
  try {
    const histRef = ref(rtdb, `users/${uid}/history`);
    await remove(histRef);
  } catch (err) {
    console.error('Error clearing watch history from RTDB:', err);
  }
};

export const listenToHistory = (uid: string, callback: (items: HistoryItem[]) => void): (() => void) => {
  if (!uid) return () => {};
  const histRef = ref(rtdb, `users/${uid}/history`);
  return onValue(histRef, (snap) => {
    if (!snap.exists()) {
      callback([]);
      return;
    }
    const val = snap.val();
    const items = Object.values(val) as HistoryItem[];
    // Sort descending by watchedAt
    items.sort((a, b) => (b.watchedAt || 0) - (a.watchedAt || 0));
    // Recalculate group
    items.forEach((it) => {
      it.group = calculateDateGroup(it.watchedAt);
    });
    callback(items);
  });
};

// --- Daily Visits Logging & Stats functions ---

export const recordDailyVisit = async (uid: string): Promise<void> => {
  if (!uid) return;
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  try {
    const visitRef = ref(rtdb, `users/${uid}/visits/${year}/${month}/${day}`);
    const snap = await get(visitRef);
    if (!snap.exists()) {
      // First visit of the day!
      await set(visitRef, {
        timestamp: Date.now(),
        dateString: `${year}-${month}-${day}`,
      });

      // Update visit count in stats
      const statsRef = ref(rtdb, `users/${uid}/stats`);
      const statsSnap = await get(statsRef);
      const curCount = statsSnap.exists() ? (statsSnap.val().totalVisitDays || 0) : 0;
      await update(statsRef, {
        totalVisitDays: curCount + 1,
        lastVisitAt: Date.now(),
      });
    }
  } catch (err) {
    console.error('Error recording daily visit to RTDB:', err);
  }
};

export const recordDownload = async (uid?: string, media?: { id?: string; title?: string; url?: string }): Promise<void> => {
  if (!uid) return;
  const now = Date.now();
  try {
    const statsRef = ref(rtdb, `users/${uid}/stats`);
    const snap = await get(statsRef);
    let curDownloads = 0;
    if (snap.exists()) {
      const data = snap.val();
      curDownloads = data.totalDownloads || 0;
    }
    const newDownloads = curDownloads + 1;
    await update(statsRef, {
      totalDownloads: newDownloads,
      lastUpdated: now,
    });

    if (media?.id) {
      const key = cleanMediaKey(media.id);
      const dlRef = ref(rtdb, `users/${uid}/downloads/${key}`);
      await set(dlRef, {
        id: media.id,
        title: media.title || 'Downloaded Item',
        url: media.url || '',
        downloadedAt: now,
      });
    }
  } catch (err) {
    console.error('Error recording download in RTDB:', err);
  }
};

export const listenToUserStats = (uid: string, callback: (stats: UserStats) => void): (() => void) => {
  if (!uid) return () => {};
  const statsRef = ref(rtdb, `users/${uid}/stats`);
  return onValue(statsRef, (snap) => {
    if (!snap.exists()) {
      callback({
        totalWatchMinutes: 0,
        totalTitlesWatched: 0,
        totalWatchlistCount: 0,
        totalDownloads: 0,
        lastUpdated: Date.now(),
      });
      return;
    }
    const val = snap.val();
    callback({
      totalWatchMinutes: val.totalWatchMinutes || 0,
      totalTitlesWatched: val.totalTitlesWatched || 0,
      totalWatchlistCount: val.totalWatchlistCount || 0,
      totalDownloads: val.totalDownloads || 0,
      totalVisitDays: val.totalVisitDays || 1,
      lastUpdated: val.lastUpdated || Date.now(),
      lastVisitAt: val.lastVisitAt,
    });
  });
};

