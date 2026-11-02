import React, { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { auth } from '../firebase.ts';
import { syncPushSubscriptionBackground } from '../utils/pushNotificationService.ts';

/**
 * Background worker to ensure push notifications are actively registered
 * in Firebase Realtime Database and Cloudflare Worker.
 */
export const BackgroundPushWorker: React.FC = () => {
  const { user } = useAuth();
  const isSyncingRef = useRef(false);

  useEffect(() => {
    const runWorkerSync = async () => {
      if (isSyncingRef.current) return;
      const effectiveUid = user?.uid || auth.currentUser?.uid;
      if (!effectiveUid || !navigator.onLine) return;

      isSyncingRef.current = true;
      try {
        await syncPushSubscriptionBackground(effectiveUid);
      } catch (err) {
        console.warn('[BackgroundPushWorker] Worker sync encountered an issue:', err);
      } finally {
        isSyncingRef.current = false;
      }
    };

    // 1. Run immediately on mount
    runWorkerSync();

    // 2. Run whenever window comes into focus or page becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runWorkerSync();
      }
    };

    // 3. Run on network reconnection
    const handleOnline = () => {
      runWorkerSync();
    };

    // 4. Periodic background check every 2 minutes
    const interval = setInterval(runWorkerSync, 2 * 60 * 1000);

    // 5. Auth state listener to immediately sync when user logs in
    const unsubAuth = auth.onAuthStateChanged((u) => {
      if (u) {
        syncPushSubscriptionBackground(u.uid).catch(() => {});
      }
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(interval);
      unsubAuth();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    };
  }, [user?.uid]);

  return null;
};
