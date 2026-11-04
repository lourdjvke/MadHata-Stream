/**
 * MadHata Cloudflare Push Worker
 * Handles Web Push subscription registration, RTDB persistence, cron-scheduled dispatches,
 * recording notifications into RTDB with status tracking ("pending" -> "sent" / "failed"),
 * and personalized movie & short drama recommendations based on user interests.
 */

const VAPID_PUBLIC_KEY =
  'BN70RGP-8oP5WPYxgv91caPYc1SN41Cdd5yIEyHMkF-ggxnyPLYuC9HRdhqx4R5NBE0FpF90_pxzynZHSLV_bH0';
const VAPID_PRIVATE_KEY = 'zdo0IJ1Y9fJ6Bdor58qEC6tYoAIbwO6jxAl6kJMbe8c';
const VAPID_SUBJECT = 'mailto:support@madhata.app';
const RTDB_BASE = 'https://madhata-dcfef-default-rtdb.firebaseio.com';
const TRENDING_SHORTS_URL = 'https://chartdrama-api.levity-build.workers.dev/trending';
const CATEGORY_MEDIA_URL = 'https://media-resolver-worker.levity-build.workers.dev/category';

// Minimum spacing between automatic notifications per user (2 hours)
const MIN_NOTIFICATION_INTERVAL_MS = 2 * 60 * 60 * 1000;

// CORS response helper
function corsResponse(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

// Clean RTDB path key using safe SHA-256 hex string
async function cleanKey(key) {
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

// Base64URL helper
function base64UrlEncode(bytes) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Generate VAPID Authorization JWT (RFC 8292 ES256)
async function generateVapidHeader(endpoint) {
  const url = new URL(endpoint);
  const aud = `${url.protocol}//${url.host}`;
  const now = Math.floor(Date.now() / 1000);

  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud,
    exp: now + 43200, // 12 hours
    sub: VAPID_SUBJECT,
  };

  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  // Import VAPID private key
  const pubRaw = base64UrlDecode(VAPID_PUBLIC_KEY);
  const x = base64UrlEncode(pubRaw.subarray(1, 33));
  const y = base64UrlEncode(pubRaw.subarray(33, 65));

  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x,
    y,
    d: VAPID_PRIVATE_KEY,
    ext: true,
  };

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signatureRaw = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, signInput)
  );

  const signatureB64 = base64UrlEncode(signatureRaw);
  const token = `${headerB64}.${payloadB64}.${signatureB64}`;

  return `vapid t=${token}, k=${VAPID_PUBLIC_KEY}`;
}

// Encrypt Web Push payload using RFC 8291 (aes128gcm)
async function encryptPayload(payloadJson, p256dhBase64, authBase64) {
  const plaintext = new TextEncoder().encode(payloadJson);
  const clientPubBytes = base64UrlDecode(p256dhBase64);
  const authSecretBytes = base64UrlDecode(authBase64);

  // 1. Import client public key
  const clientKey = await crypto.subtle.importKey(
    'raw',
    clientPubBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );

  // 2. Generate local ephemeral key
  const localKeypair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  const localPubBytes = new Uint8Array(
    await crypto.subtle.exportKey('raw', localKeypair.publicKey)
  );

  // 3. ECDH shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientKey },
    localKeypair.privateKey,
    256
  );

  // 4. HKDF derivation (RFC 8291 Section 3.2: PRK_key = HKDF-Extract(salt = auth_secret, IKM = ecdh_secret))
  const sharedKey = await crypto.subtle.importKey(
    'raw',
    sharedSecret,
    'HKDF',
    false,
    ['deriveBits']
  );

  const infoPrefix = new TextEncoder().encode('WebPush: info\0');
  const ikmInfo = new Uint8Array(infoPrefix.length + clientPubBytes.length + localPubBytes.length);
  ikmInfo.set(infoPrefix, 0);
  ikmInfo.set(clientPubBytes, infoPrefix.length);
  ikmInfo.set(localPubBytes, infoPrefix.length + clientPubBytes.length);

  const ikmBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecretBytes, info: ikmInfo },
    sharedKey,
    256
  );

  const ikmKey = await crypto.subtle.importKey('raw', ikmBits, 'HKDF', false, [
    'deriveKey',
    'deriveBits',
  ]);

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0');
  const cekKey = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: salt, info: cekInfo },
    ikmKey,
    { name: 'AES-GCM', length: 128 },
    false,
    ['encrypt']
  );

  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');
  const nonceBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt, info: nonceInfo },
    ikmKey,
    96
  );
  const nonce = new Uint8Array(nonceBits);

  // Padding RFC 8291: plaintext || 0x02
  const padded = new Uint8Array(plaintext.length + 1);
  padded.set(plaintext, 0);
  padded[plaintext.length] = 0x02;

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, cekKey, padded)
  );

  // RFC 8291 binary structure:
  // salt (16 bytes) || rs (4 bytes = 4096) || idlen (1 byte = 65) || localPubBytes (65 bytes) || ciphertext
  const body = new Uint8Array(16 + 4 + 1 + localPubBytes.length + ciphertext.length);
  body.set(salt, 0);
  body[16] = 0x00;
  body[17] = 0x00;
  body[18] = 0x10;
  body[19] = 0x00;
  body[20] = localPubBytes.length;
  body.set(localPubBytes, 21);
  body.set(ciphertext, 21 + localPubBytes.length);

  return body;
}

// Create initial notification record in RTDB with "pending" status
async function createNotificationRecord(uid, notificationData) {
  const notifId = 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const record = {
    id: notifId,
    uid: uid || 'anonymous',
    title: notificationData.title || '🎬 MadHata Recommendation',
    body: notificationData.body || 'New stream ready to watch on MadHata with zero ads!',
    url: notificationData.url || '/',
    icon: notificationData.icon || 'https://i.ibb.co/DDbzq5nG/Meta-AI-882313168-4033689700101698-2768700689194481107-n-20261101-055728-webp.jpg',
    image: notificationData.image || null,
    status: 'pending',
    createdAt: Date.now(),
    sentAt: null,
    read: false,
    error: null,
  };

  try {
    await fetch(`${RTDB_BASE}/users/${encodeURIComponent(record.uid)}/notifications/${notifId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    // Also save in central directory
    await fetch(`${RTDB_BASE}/notifications/${notifId}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    }).catch(() => {});
  } catch (e) {
    console.warn('Failed saving initial notification record in RTDB:', e);
  }

  return { notifId, record };
}

// Update notification status in RTDB ("sent" / "failed")
async function updateNotificationStatus(uid, notifId, status, details = {}) {
  const updatePayload = {
    status,
    updatedAt: Date.now(),
    ...(status === 'sent' ? { sentAt: Date.now() } : {}),
    ...details,
  };

  try {
    await fetch(`${RTDB_BASE}/users/${encodeURIComponent(uid)}/notifications/${notifId}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload),
    });
    await fetch(`${RTDB_BASE}/notifications/${notifId}.json`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatePayload),
    }).catch(() => {});
  } catch (e) {
    console.warn('Failed updating notification status in RTDB:', e);
  }
}

// Send Web Push notification to a single subscriber
async function sendPushToSubscriber(subscriptionRecord, notificationData) {
  const sub = subscriptionRecord.subscription;
  if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
    return { ok: false, error: 'Malformed subscription keys' };
  }

  try {
    const payloadJson = JSON.stringify(notificationData);
    const encryptedBody = await encryptPayload(payloadJson, sub.keys.p256dh, sub.keys.auth);
    const authHeader = await generateVapidHeader(sub.endpoint);

    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'TTL': '86400',
        'Urgency': 'normal',
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        'Authorization': authHeader,
      },
      body: encryptedBody,
    });

    if (res.status === 201 || res.status === 200) {
      return { ok: true, status: res.status };
    }

    // Endpoint expired or unsubscribed
    if (res.status === 404 || res.status === 410) {
      const endpointHash = await cleanKey(sub.endpoint);
      await fetch(`${RTDB_BASE}/push_subscriptions/${endpointHash}.json`, {
        method: 'DELETE',
      }).catch(() => {});
      return { ok: false, status: res.status, gone: true };
    }

    const text = await res.text().catch(() => '');
    return { ok: false, status: res.status, error: text };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Check when user was last sent a notification to ensure nice 5x daily spacing
async function getLastNotificationTime(uid) {
  try {
    const res = await fetch(`${RTDB_BASE}/users/${encodeURIComponent(uid)}/notifications.json?shallow=false`);
    if (!res.ok) return 0;
    const notifs = await res.json();
    if (!notifs) return 0;

    let latest = 0;
    for (const k of Object.keys(notifs)) {
      const n = notifs[k];
      const t = n.sentAt || n.createdAt || 0;
      if (t > latest) latest = t;
    }
    return latest;
  } catch {
    return 0;
  }
}

// Pick recommendations based on subscriber preferences
async function pickRecommendationForUser(interests, trendingShorts) {
  const safeInterests = Array.isArray(interests) && interests.length > 0 ? interests : ['Horror', 'Sci-Fi', 'Short Drama'];

  // Check if subscriber is interested in Short Drama or vertical video (or 40% probability)
  const wantsShorts =
    safeInterests.some((i) => /short|drama|mini/i.test(i)) || Math.random() < 0.4;

  if (wantsShorts && trendingShorts && trendingShorts.length > 0) {
    const randomShort = trendingShorts[Math.floor(Math.random() * trendingShorts.length)];
    const synopsis = randomShort.synopsis ? randomShort.synopsis.slice(0, 95) + '...' : 'Watch the latest episodes in vertical stream!';
    return {
      title: `✨ Trending Drama: ${randomShort.title}`,
      body: synopsis,
      url: `/shorts?slug=${encodeURIComponent(randomShort.slug || randomShort.id)}`,
      icon: randomShort.poster || 'https://i.ibb.co/DDbzq5nG/Meta-AI-882313168-4033689700101698-2768700689194481107-n-20261101-055728-webp.jpg',
      image: randomShort.poster,
    };
  }

  // Movie category recommendation
  const chosenInterest = safeInterests[Math.floor(Math.random() * safeInterests.length)] || 'Horror';
  const categoryHeaders = {
    Action: '⚡ Adrenaline High',
    Romance: '❤️ Heartstrings Pick',
    Comedy: '😂 Laugh Out Loud',
    Horror: '👻 Midnight Chills',
    'Sci-Fi': '🚀 Future Horizons',
    Anime: '🔥 Anime Premiere',
    Thriller: '⚡ Edge of Your Seat',
    Mystery: '🔍 Mystery Unfolded',
    Animation: '🎨 Animation Premiere',
    Drama: '🎭 High Drama Pick',
  };

  const header = categoryHeaders[chosenInterest] || `🍿 Top ${chosenInterest} Stream`;

  return {
    title: `🎬 MadHata: ${header}`,
    body: `New stream added to ${chosenInterest} collection. Watch free with zero ads!`,
    url: `/search?q=${encodeURIComponent(chosenInterest)}`,
    icon: 'https://i.ibb.co/DDbzq5nG/Meta-AI-882313168-4033689700101698-2768700689194481107-n-20261101-055728-webp.jpg',
  };
}

// Core dispatch function with RTDB status tracking ("pending" -> "sent" / "failed")
async function dispatchPushNotifications(testNotification = null, force = false, targetUid = null, targetUids = null) {
  // 1. Fetch subscriptions from RTDB
  const subsRes = await fetch(`${RTDB_BASE}/push_subscriptions.json`);
  if (!subsRes.ok) {
    return { error: 'Failed to fetch subscriptions from RTDB', status: subsRes.status };
  }
  const subsData = await subsRes.json();
  if (!subsData) {
    return { message: 'No active push subscriptions found in RTDB', total: 0 };
  }

  let subscribers = Object.values(subsData);
  if (Array.isArray(targetUids) && targetUids.length > 0) {
    subscribers = subscribers.filter((s) => targetUids.includes(s.uid));
  } else if (targetUid) {
    subscribers = subscribers.filter((s) => s.uid === targetUid);
  }

  if (subscribers.length === 0) {
    return { message: 'No matching subscribers found', total: 0 };
  }

  // 2. Fetch trending short dramas for recommendations
  let trendingShorts = [];
  try {
    const shortsRes = await fetch(TRENDING_SHORTS_URL);
    if (shortsRes.ok) {
      const parsed = await shortsRes.json();
      trendingShorts = parsed.results || [];
    }
  } catch (err) {
    console.warn('Could not fetch trending shorts:', err);
  }

  // 3. Group subscribers by UID to prevent duplicate notifications per user
  const byUser = {};
  for (const s of subscribers) {
    const uid = s.uid || 'anonymous';
    if (!byUser[uid]) byUser[uid] = [];
    byUser[uid].push(s);
  }

  const results = {
    totalUsers: Object.keys(byUser).length,
    sent: 0,
    skipped: 0,
    failed: 0,
    details: [],
    timestamp: Date.now(),
  };

  const now = Date.now();

  for (const uid of Object.keys(byUser)) {
    const userSubs = byUser[uid];

    // Check last notification time unless force is requested
    if (!force && !testNotification) {
      const lastSentTime = await getLastNotificationTime(uid);
      if (now - lastSentTime < MIN_NOTIFICATION_INTERVAL_MS) {
        results.skipped++;
        results.details.push({ uid, status: 'skipped_throttled', lastSentAgoMin: Math.round((now - lastSentTime) / 60000) });
        continue;
      }
    }

    const firstSub = userSubs[0];
    const notification =
      testNotification ||
      (await pickRecommendationForUser(firstSub.interests, trendingShorts));

    // A. Write initial record to RTDB with "pending" status
    const { notifId } = await createNotificationRecord(uid, notification);

    let anySuccess = false;
    let lastError = null;

    // B. Send to all endpoints for this user
    for (const subRecord of userSubs) {
      const sendRes = await sendPushToSubscriber(subRecord, notification);
      if (sendRes.ok) {
        anySuccess = true;
      } else {
        lastError = sendRes.error || `Status ${sendRes.status}`;
      }
    }

    // C. Update RTDB record with the resulting status
    if (anySuccess) {
      await updateNotificationStatus(uid, notifId, 'sent', {
        deviceCount: userSubs.length,
      });
      results.sent++;
      results.details.push({ uid, notifId, status: 'sent', title: notification.title });
    } else {
      await updateNotificationStatus(uid, notifId, 'failed', {
        error: lastError || 'All user endpoints failed',
      });
      results.failed++;
      results.details.push({ uid, notifId, status: 'failed', error: lastError });
    }
  }

  // D. Log the cron run to RTDB for complete audit trail
  try {
    await fetch(`${RTDB_BASE}/cron_runs/${now}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(results),
    });
  } catch {}

  return results;
}

export default {
  // HTTP Fetch Handler
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204);
    }

    // Healthcheck / Status
    if (url.pathname === '/' || url.pathname === '/health') {
      return corsResponse(
        JSON.stringify({
          status: 'ok',
          service: 'madhata-push-worker',
          vapidPublicKey: VAPID_PUBLIC_KEY,
          schedule: 'Automated 2-hour cron cycle with 5+ daily spaced notifications',
          timestamp: new Date().toISOString(),
        })
      );
    }

    // Subscribe endpoint
    if (url.pathname === '/subscribe' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { uid, subscription, interests, timezone } = body;

        if (!subscription || !subscription.endpoint) {
          return corsResponse(JSON.stringify({ error: 'Missing subscription endpoint' }), 400);
        }

        const endpointHash = await cleanKey(subscription.endpoint);
        const record = {
          uid: uid || 'anonymous',
          subscription,
          interests: Array.isArray(interests) ? interests : [],
          timezone: timezone || 'UTC',
          updatedAt: Date.now(),
        };

        // Save in RTDB push_subscriptions
        await fetch(`${RTDB_BASE}/push_subscriptions/${endpointHash}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record),
        });

        // Also update user record if uid is available
        if (uid && uid !== 'anonymous') {
          await fetch(`${RTDB_BASE}/users/${encodeURIComponent(uid)}/preferences/interests.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(interests || []),
          }).catch(() => {});

          await fetch(`${RTDB_BASE}/users/${encodeURIComponent(uid)}/push_subscription.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record),
          }).catch(() => {});
        }

        return corsResponse(
          JSON.stringify({ success: true, key: endpointHash, timestamp: Date.now() })
        );
      } catch (err) {
        return corsResponse(JSON.stringify({ error: err.message }), 500);
      }
    }

    // Trigger cron / manual dispatch endpoint (accepts ?force=true, ?uid=..., and body.targetUids)
    if (url.pathname === '/dispatch' || url.pathname === '/trigger-cron' || url.pathname === '/send-test-push') {
      let customNotification = null;
      let bodyTargetUids = null;
      let bodyTargetUid = null;
      if (request.method === 'POST') {
        try {
          const body = await request.json();
          if (body.title || body.body) customNotification = body;
          if (Array.isArray(body.targetUids)) bodyTargetUids = body.targetUids;
          if (body.targetUid) bodyTargetUid = body.targetUid;
        } catch {}
      }

      const force = url.searchParams.get('force') === 'true' || request.method === 'POST';
      const targetUid = bodyTargetUid || url.searchParams.get('uid');
      const targetUids = bodyTargetUids || (url.searchParams.get('uids') ? url.searchParams.get('uids').split(',') : null);

      const summary = await dispatchPushNotifications(customNotification, force, targetUid, targetUids);
      return corsResponse(JSON.stringify(summary));
    }

    // Check & trigger if due for user (called by background app worker)
    if (url.pathname === '/trigger-check') {
      const uid = url.searchParams.get('uid');
      if (!uid) return corsResponse(JSON.stringify({ error: 'Missing uid' }), 400);

      const summary = await dispatchPushNotifications(null, false, uid);
      return corsResponse(JSON.stringify(summary));
    }

    return corsResponse(JSON.stringify({ error: 'Not found' }), 404);
  },

  // Cron Schedule Handler (Executed by Cloudflare every 2 hours)
  async scheduled(event, env, ctx) {
    console.log(`[PushWorker] Scheduled cron trigger fired at ${new Date().toISOString()}`);
    ctx.waitUntil(
      dispatchPushNotifications(null, false).catch(async (err) => {
        console.error('[PushWorker] Scheduled dispatch error:', err);
        try {
          await fetch(`${RTDB_BASE}/cron_errors/${Date.now()}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: err.message || String(err), timestamp: Date.now() }),
          });
        } catch {}
      })
    );
  },
};
