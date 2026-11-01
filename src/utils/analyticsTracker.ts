import { ref, get, set, update, runTransaction, DataSnapshot } from 'firebase/database';
import { rtdb } from '../firebase.ts';

// Clean key helper for RTDB paths
export const cleanAnalyticsKey = (key: string): string => {
  if (!key) return 'unknown';
  return encodeURIComponent(key)
    .replace(/\./g, '%2E')
    .replace(/#/g, '%23')
    .replace(/\$/g, '%24')
    .replace(/\[/g, '%5B')
    .replace(/\]/g, '%5D')
    .replace(/\//g, '_');
};

// Date string format YYYY-MM-DD
export const getTodayDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Safe timeout wrapper for RTDB network calls
const safeRtdbGet = async (dbRef: any, timeoutMs = 2500): Promise<DataSnapshot | null> => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null;
  return Promise.race([
    get(dbRef).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
};

/**
 * 1. Track App Open & Active Day
 */
export const trackAppOpen = async (uid?: string): Promise<void> => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  const dateStr = getTodayDateString();
  const now = Date.now();
  const userKey = uid || 'anonymous_user';

  try {
    // Global active user tracking
    const globalDayUserRef = ref(rtdb, `analytics/global/daily_active_users/${dateStr}/${userKey}`);
    set(globalDayUserRef, true).catch(() => {});

    // Global daily app opens count
    const globalOpensRef = ref(rtdb, `analytics/global/daily_app_opens/${dateStr}`);
    runTransaction(globalOpensRef, (current) => (current || 0) + 1).catch(() => {});

    if (uid && uid !== 'offline_user') {
      // User active days
      const userDayRef = ref(rtdb, `users/${uid}/analytics/active_days/${dateStr}`);
      const snap = await safeRtdbGet(userDayRef, 2000);
      let curCount = 0;
      if (snap && snap.exists && snap.exists()) {
        curCount = snap.val()?.openCount || 0;
      }
      update(userDayRef, {
        openCount: curCount + 1,
        lastSeenAt: now,
      }).catch(() => {});

      // User lifetime stats
      const userLifetimeRef = ref(rtdb, `users/${uid}/analytics/lifetime`);
      const lifeSnap = await safeRtdbGet(userLifetimeRef, 2000);
      let totalAppOpens = 0;
      let totalSessions = 0;
      let totalTimeSpentSec = 0;

      if (lifeSnap && lifeSnap.exists && lifeSnap.exists()) {
        const val = lifeSnap.val();
        totalAppOpens = val.totalAppOpens || 0;
        totalSessions = val.totalSessions || 0;
        totalTimeSpentSec = val.totalTimeSpentSec || 0;
      }

      const newOpens = totalAppOpens + 1;
      const newSessions = totalSessions + 1;
      const avgDuration = newSessions > 0 ? Math.round(totalTimeSpentSec / newSessions) : 0;

      update(userLifetimeRef, {
        totalAppOpens: newOpens,
        totalSessions: newSessions,
        avgSessionDurationSec: avgDuration,
        lastActiveAt: now,
      }).catch(() => {});
    }
  } catch (e) {
    console.warn('Analytics trackAppOpen silent catch:', e);
  }
};

/**
 * 2. Track Route View & Time Spent
 */
export const trackPageTime = async (
  routeName: string,
  durationSec: number,
  uid?: string
): Promise<void> => {
  if (durationSec <= 0) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  const cleanRoute = cleanAnalyticsKey(routeName || 'home');
  const dateStr = getTodayDateString();
  const now = Date.now();

  try {
    // Global route view increment
    const globalRouteRef = ref(rtdb, `analytics/global/page_views/${cleanRoute}`);
    runTransaction(globalRouteRef, (current) => (current || 0) + 1).catch(() => {});

    if (uid && uid !== 'offline_user') {
      // User page time breakdown
      const userPageRef = ref(rtdb, `users/${uid}/analytics/page_time/${cleanRoute}`);
      const pageSnap = await safeRtdbGet(userPageRef, 2000);
      let prevSec = 0;
      let prevVisits = 0;

      if (pageSnap && pageSnap.exists && pageSnap.exists()) {
        const val = pageSnap.val();
        prevSec = val.secondsSpent || 0;
        prevVisits = val.visitCount || 0;
      }

      update(userPageRef, {
        secondsSpent: prevSec + Math.round(durationSec),
        visitCount: prevVisits + 1,
        lastVisitedAt: now,
      }).catch(() => {});

      // User lifetime time spent
      const userLifetimeRef = ref(rtdb, `users/${uid}/analytics/lifetime`);
      const lifeSnap = await safeRtdbGet(userLifetimeRef, 2000);
      if (lifeSnap && lifeSnap.exists && lifeSnap.exists()) {
        const val = lifeSnap.val();
        const totalTimeSpentSec = (val.totalTimeSpentSec || 0) + Math.round(durationSec);
        const totalSessions = val.totalSessions || 1;
        const avgSessionDurationSec = Math.round(totalTimeSpentSec / Math.max(1, totalSessions));

        update(userLifetimeRef, {
          totalTimeSpentSec,
          avgSessionDurationSec,
          lastActiveAt: now,
        }).catch(() => {});
      }

      // User active day total seconds update
      const userDayRef = ref(rtdb, `users/${uid}/analytics/active_days/${dateStr}`);
      const daySnap = await safeRtdbGet(userDayRef, 1500);
      let daySec = 0;
      if (daySnap && daySnap.exists && daySnap.exists()) {
        daySec = daySnap.val()?.totalSecondsOnDay || 0;
      }
      update(userDayRef, {
        totalSecondsOnDay: daySec + Math.round(durationSec),
        lastSeenAt: now,
      }).catch(() => {});
    }
  } catch (e) {
    console.warn('Analytics trackPageTime silent catch:', e);
  }
};

/**
 * 3. Track Search Terms
 */
export const trackSearchQuery = async (query: string, uid?: string): Promise<void> => {
  if (!query || !query.trim()) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  const cleanQuery = cleanAnalyticsKey(query.trim().toLowerCase());
  const now = Date.now();

  try {
    const globalSearchRef = ref(rtdb, `analytics/global/popular_searches/${cleanQuery}`);
    const snap = await safeRtdbGet(globalSearchRef, 2000);
    let count = 0;
    if (snap && snap.exists && snap.exists()) {
      count = snap.val()?.searchCount || 0;
    }

    update(globalSearchRef, {
      term: query.trim(),
      searchCount: count + 1,
      lastSearchedAt: now,
    }).catch(() => {});

    if (uid && uid !== 'offline_user') {
      const userSearchRef = ref(rtdb, `users/${uid}/analytics/recent_searches/${cleanQuery}`);
      update(userSearchRef, {
        term: query.trim(),
        searchedAt: now,
      }).catch(() => {});
    }
  } catch (e) {
    console.warn('Analytics trackSearchQuery silent catch:', e);
  }
};

/**
 * 4. Track Shorts Performance & Interactions
 */
export const trackShortsView = async (
  slug: string,
  watchSeconds: number,
  completed = false,
  episodeClicked = false,
  title?: string,
  uid?: string
): Promise<void> => {
  if (!slug) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  const cleanSlug = cleanAnalyticsKey(slug);
  const now = Date.now();

  try {
    const globalShortRef = ref(rtdb, `analytics/global/shorts_performance/${cleanSlug}`);
    const snap = await safeRtdbGet(globalShortRef, 2000);

    let views = 0;
    let completions = 0;
    let totalWatchSeconds = 0;
    let epClicks = 0;

    if (snap && snap.exists && snap.exists()) {
      const val = snap.val();
      views = val.views || 0;
      completions = val.completions || 0;
      totalWatchSeconds = val.totalWatchSeconds || 0;
      epClicks = val.episodeClicks || 0;
    }

    update(globalShortRef, {
      title: title || slug,
      slug,
      views: views + 1,
      completions: completions + (completed ? 1 : 0),
      totalWatchSeconds: totalWatchSeconds + Math.round(watchSeconds),
      episodeClicks: epClicks + (episodeClicked ? 1 : 0),
      lastViewedAt: now,
    }).catch(() => {});

    if (uid && uid !== 'offline_user') {
      const userShortRef = ref(rtdb, `users/${uid}/analytics/shorts_history/${cleanSlug}`);
      update(userShortRef, {
        slug,
        title: title || slug,
        lastWatchSeconds: Math.round(watchSeconds),
        completed,
        lastViewedAt: now,
      }).catch(() => {});
    }
  } catch (e) {
    console.warn('Analytics trackShortsView silent catch:', e);
  }
};
