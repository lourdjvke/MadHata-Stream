import { ref, get, set } from 'firebase/database';
import { rtdb } from '../firebase.ts';

export const VAPID_PUBLIC_KEY =
  'BN70RGP-8oP5WPYxgv91caPYc1SN41Cdd5yIEyHMkF-ggxnyPLYuC9HRdhqx4R5NBE0FpF90_pxzynZHSLV_bH0';

export const PUSH_WORKER_URL = 'https://madhata-push-worker.levity-build.workers.dev';

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function cleanKey(key: string): Promise<string> {
  if (!key) return 'anonymous_' + Date.now();
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return key.replace(/[^a-zA-Z0-9_-]/g, '_');
  }
}

/**
 * Loads user interests from localStorage and Firebase RTDB
 */
export async function loadUserInterests(uid?: string): Promise<string[]> {
  let saved: string[] = [];
  try {
    const local = localStorage.getItem('madhata_user_interests');
    if (local) {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) saved = parsed;
    }
  } catch {}

  if (uid && uid !== 'offline_user' && navigator.onLine) {
    try {
      const prefRef = ref(rtdb, `users/${uid}/preferences/interests`);
      const snap = await get(prefRef);
      if (snap.exists()) {
        const val = snap.val();
        if (Array.isArray(val) && val.length > 0) {
          saved = val;
          localStorage.setItem('madhata_user_interests', JSON.stringify(val));
        }
      }
    } catch (e) {
      console.warn('Failed reading interests from RTDB:', e);
    }
  }

  return saved;
}

/**
 * Saves user interests to localStorage and Firebase RTDB
 */
export async function saveUserInterests(uid: string | undefined, interests: string[]): Promise<void> {
  try {
    localStorage.setItem('madhata_user_interests', JSON.stringify(interests));
  } catch {}

  if (uid && uid !== 'offline_user' && navigator.onLine) {
    try {
      const prefRef = ref(rtdb, `users/${uid}/preferences`);
      await set(prefRef, {
        interests,
        updatedAt: Date.now(),
      });
    } catch (e) {
      console.warn('Failed saving preferences to RTDB:', e);
    }
  }
}

export interface PushSubscriptionResult {
  permission: NotificationPermission;
  subscribed: boolean;
  subscription?: PushSubscriptionJSON;
  error?: string;
}

/**
 * Requests push permission, subscribes the browser, syncs to RTDB & Cloudflare Worker
 */
export async function subscribeToPushNotifications(
  uid: string | undefined,
  interests: string[]
): Promise<PushSubscriptionResult> {
  // Always save the interests locally and in RTDB
  await saveUserInterests(uid, interests);

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return {
      permission: 'denied',
      subscribed: false,
      error: 'Notifications are not supported in this browser.',
    };
  }

  let permission: NotificationPermission = Notification.permission;
  if (permission !== 'granted') {
    try {
      permission = await Notification.requestPermission();
    } catch (err: any) {
      console.warn('Notification permission request error:', err);
      return {
        permission: 'denied',
        subscribed: false,
        error: err.message,
      };
    }
  }

  if (permission !== 'granted') {
    return {
      permission,
      subscribed: false,
      error: 'Push notification permission was not granted.',
    };
  }

  if (!('serviceWorker' in navigator)) {
    return {
      permission,
      subscribed: false,
      error: 'Service Workers are not supported.',
    };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as unknown as BufferSource,
      });
    }

    const subJson = subscription.toJSON();
    const effectiveUid = uid || 'guest_' + (localStorage.getItem('madhata_guest_id') || Math.random().toString(36).substring(2, 10));
    if (!uid && !localStorage.getItem('madhata_guest_id')) {
      localStorage.setItem('madhata_guest_id', effectiveUid);
    }

    const subscriptionPayload = {
      uid: effectiveUid,
      subscription: subJson,
      interests,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      subscribedAt: Date.now(),
      endpoint: subJson.endpoint || '',
    };

    // 1. Save to Firebase RTDB for individual user record
    if (navigator.onLine) {
      try {
        const userSubRef = ref(rtdb, `users/${effectiveUid}/push_subscription`);
        await set(userSubRef, subscriptionPayload);

        // Also save in central push_subscriptions directory in RTDB for the Cloudflare Worker
        const endpointHash = await cleanKey(subJson.endpoint || effectiveUid);
        const centralSubRef = ref(rtdb, `push_subscriptions/${endpointHash}`);
        await set(centralSubRef, subscriptionPayload);
      } catch (err) {
        console.warn('Failed saving push subscription to RTDB:', err);
      }

      // 2. Register with Cloudflare Push Worker
      try {
        fetch(`${PUSH_WORKER_URL}/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscriptionPayload),
        }).catch((e) => console.warn('Push worker subscription registration silent catch:', e));
      } catch (err) {
        console.warn('Failed notifying push worker:', err);
      }
    }

    return {
      permission,
      subscribed: true,
      subscription: subJson,
    };
  } catch (err: any) {
    console.error('Failed to subscribe to push manager:', err);
    return {
      permission,
      subscribed: false,
      error: err.message,
    };
  }
}
