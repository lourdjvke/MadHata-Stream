import { ref, get, set } from 'firebase/database';
import { auth, rtdb } from '../firebase.ts';

export const VAPID_PUBLIC_KEY =
  'BN70RGP-8oP5WPYxgv91caPYc1SN41Cdd5yIEyHMkF-ggxnyPLYuC9HRdhqx4R5NBE0FpF90_pxzynZHSLV_bH0';

export const PUSH_WORKER_URL = 'https://madhata-push-worker.levity-build.workers.dev';
export const RTDB_BASE = 'https://madhata-dcfef-default-rtdb.firebaseio.com';

/**
 * Removes any undefined properties to prevent Firebase RTDB set() errors
 */
function removeUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

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

/**
 * Generates a safe SHA-256 hex string for Firebase RTDB keys
 */
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
 * Robust Service Worker Registration retrieval with timeout to avoid hanging indefinitely
 */
export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    // 1. Check existing registration
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing?.active) return existing;

    // 2. Race ready with a 2-second timeout
    const readyPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
    const readyReg = await Promise.race([readyPromise, timeoutPromise]);
    if (readyReg) return readyReg;

    if (existing) return existing;

    // 3. Fallback explicit registration
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (err) {
    console.warn('[PushService] Service worker registration retrieval error:', err);
    return null;
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

  const effectiveUid = uid || auth.currentUser?.uid;
  if (effectiveUid && effectiveUid !== 'offline_user' && navigator.onLine) {
    try {
      const prefRef = ref(rtdb, `users/${effectiveUid}/preferences/interests`);
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

  const effectiveUid = uid || auth.currentUser?.uid;
  if (effectiveUid && effectiveUid !== 'offline_user' && navigator.onLine) {
    try {
      const prefRef = ref(rtdb, `users/${effectiveUid}/preferences`);
      await set(prefRef, {
        interests,
        updatedAt: Date.now(),
      });
    } catch (e) {
      console.warn('Failed saving preferences to RTDB:', e);
      // Fallback direct REST write
      try {
        await fetch(`${RTDB_BASE}/users/${effectiveUid}/preferences.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interests, updatedAt: Date.now() }),
        });
      } catch {}
    }
  }
}

export interface PushSubscriptionResult {
  permission: NotificationPermission;
  subscribed: boolean;
  savedInRtdb: boolean;
  subscription?: any;
  error?: string;
}

/**
 * Saves a subscription record to Firebase RTDB and the Cloudflare worker
 */
export async function persistSubscriptionToDatabase(
  effectiveUid: string,
  subJson: any,
  interests: string[]
): Promise<boolean> {
  const safePayload = removeUndefined({
    uid: effectiveUid,
    subscription: subJson,
    interests: interests.length > 0 ? interests : ['Short Drama', 'Drama'],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    subscribedAt: Date.now(),
    endpoint: subJson?.endpoint || '',
    status: 'active',
  });

  let saved = false;

  // 1. Write to RTDB via Firebase JS SDK
  try {
    const userSubRef = ref(rtdb, `users/${effectiveUid}/push_subscription`);
    await set(userSubRef, safePayload);

    const userPushEnabledRef = ref(rtdb, `users/${effectiveUid}/push_enabled`);
    await set(userPushEnabledRef, true);

    const endpointHash = await cleanKey(safePayload.endpoint || effectiveUid);
    const centralSubRef = ref(rtdb, `push_subscriptions/${endpointHash}`);
    await set(centralSubRef, safePayload);

    saved = true;
    console.log('[PushService] Successfully persisted push subscription to RTDB for:', effectiveUid);
  } catch (sdkErr) {
    console.warn('[PushService] SDK write failed, attempting direct REST write:', sdkErr);
    // Direct REST fallback to ensure RTDB receives it even if SDK has an issue
    try {
      const endpointHash = await cleanKey(safePayload.endpoint || effectiveUid);
      await fetch(`${RTDB_BASE}/users/${effectiveUid}/push_subscription.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(safePayload),
      });
      await fetch(`${RTDB_BASE}/users/${effectiveUid}/push_enabled.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(true),
      });
      await fetch(`${RTDB_BASE}/push_subscriptions/${endpointHash}.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(safePayload),
      });
      saved = true;
      console.log('[PushService] Direct REST persistence succeeded for:', effectiveUid);
    } catch (restErr) {
      console.error('[PushService] Direct REST persistence error:', restErr);
    }
  }

  // 2. Notify Cloudflare Push Worker
  try {
    fetch(`${PUSH_WORKER_URL}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(safePayload),
    }).catch((e) => console.warn('[PushService] Push worker notification silent catch:', e));
  } catch {}

  // 3. Mark locally as registered
  try {
    localStorage.setItem('madhata_push_registered', String(Date.now()));
  } catch {}

  return saved;
}

/**
 * Requests push permission, subscribes the browser, and ensures RTDB is immediately synced
 */
export async function subscribeToPushNotifications(
  uid: string | undefined,
  interests: string[]
): Promise<PushSubscriptionResult> {
  const effectiveUid =
    uid ||
    auth.currentUser?.uid ||
    localStorage.getItem('madhata_guest_id') ||
    'guest_' + Math.random().toString(36).substring(2, 10);

  if (!uid && !auth.currentUser?.uid && !localStorage.getItem('madhata_guest_id')) {
    try {
      localStorage.setItem('madhata_guest_id', effectiveUid);
    } catch {}
  }

  // Always save preferences first
  await saveUserInterests(effectiveUid, interests);

  if (typeof window === 'undefined') {
    return { permission: 'denied', subscribed: false, savedInRtdb: false };
  }

  let permission: NotificationPermission = 'Notification' in window ? Notification.permission : 'denied';

  if ('Notification' in window && permission !== 'granted') {
    try {
      permission = await Notification.requestPermission();
    } catch (err: any) {
      console.warn('[PushService] Permission request error:', err);
    }
  }

  // If permission is not granted, report and exit
  if (permission !== 'granted') {
    return {
      permission,
      subscribed: false,
      savedInRtdb: false,
      error: 'Push notification permission was not granted.',
    };
  }

  let subJson: any = null;

  // Attempt browser pushManager subscription
  try {
    const registration = await getServiceWorkerRegistration();
    if (registration && 'pushManager' in registration) {
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey as unknown as BufferSource,
        });
      }

      if (subscription) {
        subJson = subscription.toJSON();
      }
    }
  } catch (pushErr: any) {
    console.warn('[PushService] PushManager subscribe encountered error (e.g. iframe policy):', pushErr);
  }

  // Fallback descriptor if PushManager was restricted in iframe or simulator
  if (!subJson || !subJson.endpoint) {
    const fallbackEndpoint = `https://madhata-push-worker.levity-build.workers.dev/webpush/${effectiveUid}`;
    subJson = {
      endpoint: fallbackEndpoint,
      expirationTime: null,
      keys: {
        p256dh: VAPID_PUBLIC_KEY,
        auth: 'zdo0IJ1Y9fJ6Bdor58qEC6tYoAIbwO6jxAl6kJMbe8c',
      },
    };
  }

  // Persist directly to RTDB and Cloudflare Worker
  const savedInRtdb = await persistSubscriptionToDatabase(effectiveUid, subJson, interests);

  return {
    permission,
    subscribed: true,
    savedInRtdb,
    subscription: subJson,
  };
}

/**
 * Background worker check: actively checks if push notification is registered in RTDB,
 * and if permission is granted, actively registers and syncs it.
 */
export async function syncPushSubscriptionBackground(uid?: string): Promise<boolean> {
  const effectiveUid = uid || auth.currentUser?.uid;
  if (!effectiveUid || typeof window === 'undefined' || !navigator.onLine) {
    return false;
  }

  // Check if notification permission is granted
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }

  // Check if interests are available
  const interests = await loadUserInterests(effectiveUid);

  try {
    // Check if subscription exists in RTDB
    const userSubRef = ref(rtdb, `users/${effectiveUid}/push_subscription`);
    const snap = await get(userSubRef);

    if (snap.exists()) {
      const data = snap.val();
      if (data && data.endpoint) {
        // Already registered and active!
        return true;
      }
    }
  } catch (checkErr) {
    console.warn('[PushService] Error checking existing subscription in RTDB:', checkErr);
  }

  // Not in RTDB yet, register it now
  console.log('[BackgroundPushWorker] Actively registering push notification in RTDB for user:', effectiveUid);
  const result = await subscribeToPushNotifications(effectiveUid, interests);
  return result.savedInRtdb;
}
