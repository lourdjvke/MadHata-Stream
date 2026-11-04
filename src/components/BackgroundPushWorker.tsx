import React, { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { auth } from '../firebase.ts';
import { 
  syncPushSubscriptionBackground, 
  syncOfflineNotifications, 
  triggerPushCheckIfDue 
} from '../utils/pushNotificationService.ts';

/**
 * Background worker to:
 * 1. Ensure push notifications are actively registered in RTDB and Cloudflare Worker.
 * 2. Sync and display notifications received in RTDB while user was offline.
 * 3. Actively trigger scheduled recommendations spaced across the day.
 */
export const BackgroundPushWorker: React.FC = () => {
  const { user } = useAuth();
  const isSyncingRef = useRef(false);

  useEffect(() => {
    const runWorkerCycle = async () => {
      if (isSyncingRef.current) return;
      const effectiveUid = user?.uid || auth.currentUser?.uid;
      if (!effectiveUid || !navigator.onLine) return;

      isSyncingRef.current = true;
      try {
        // Step 1: Guarantee push registration in RTDB
        await syncPushSubscriptionBackground(effectiveUid);

        // Step 2: Sync and display any notifications received while offline/away
        await syncOfflineNotifications(effectiveUid);

        // Step 3: Check if a scheduled recommendation is due from Cloudflare Worker
        await triggerPushCheckIfDue(effectiveUid);
      } catch (err) {
        console.warn('[BackgroundPushWorker] Worker cycle encountered an issue:', err);
      } finally {
        isSyncingRef.current = false;
      }
    };

    // 1. Run immediately on mount
    runWorkerCycle();

    // 2. Run whenever window comes into focus or page becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runWorkerCycle();
      }
    };

    // 3. Run on network reconnection
    const handleOnline = () => {
      runWorkerCycle();
    };

    // 4. Periodic check every 2.5 minutes
    const interval = setInterval(runWorkerCycle, 2.5 * 60 * 1000);

    // 5. Auth state listener to immediately sync when user logs in
    const unsubAuth = auth.onAuthStateChanged((u) => {
      if (u) {
        syncPushSubscriptionBackground(u.uid).catch(() => {});
        syncOfflineNotifications(u.uid).catch(() => {});
        triggerPushCheckIfDue(u.uid).catch(() => {});
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
