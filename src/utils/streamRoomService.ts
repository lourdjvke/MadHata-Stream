import { 
  ref, 
  set, 
  push, 
  get, 
  remove, 
  update, 
  onValue, 
  onDisconnect, 
  Unsubscribe 
} from 'firebase/database';
import { rtdb } from '../firebase.ts';

export const PUSH_WORKER_URL = 'https://madhata-push-worker.levity-build.workers.dev';

export interface StreamRoomMember {
  uid: string;
  name: string;
  avatarIndex?: number;
  c1?: string;
  c2?: string;
  isHost?: boolean;
  online?: boolean;
  joinedAt: number;
  lastSeen?: number;
}

export interface StreamRoomMessage {
  id: string;
  senderUid: string;
  senderName: string;
  avatarIndex?: number;
  c1?: string;
  c2?: string;
  text: string;
  type?: 'text' | 'system';
  timestamp: number;
}

export interface StreamRoomPollOption {
  id: string;
  title: string;
  poster: string;
  url: string;
  source: string;
  votes: Record<string, boolean>; // uid -> true
}

export interface StreamRoomPoll {
  id: string;
  creatorUid: string;
  creatorName: string;
  question: string;
  options: StreamRoomPollOption[];
  active: boolean;
  scheduledStartTime?: number | null;
  winningOptionId?: string | null;
  createdAt: number;
}

export interface StreamRoomReaction {
  id: string;
  uid: string;
  userName: string;
  emoji: string;
  timestamp: number;
  sceneTime: string;
  mediaTitle?: string;
}

export interface RoomPlaybackState {
  currentTime: number;
  isPlaying: boolean;
  updatedAt: number;
  updatedBy: string;
  mediaUrl?: string;
  mediaId?: string;
}

export interface StreamRoom {
  id: string;
  name: string;
  poster: string;
  creatorUid: string;
  creatorName: string;
  createdAt: number;
  scheduledStartTime?: number | null;
  status: 'waiting' | 'voting' | 'scheduled' | 'playing' | 'ended';
  currentMedia?: {
    id: string;
    title: string;
    poster: string;
    url: string;
    source?: string;
  } | null;
  playback?: RoomPlaybackState;
  members?: Record<string, StreamRoomMember>;
  messages?: Record<string, StreamRoomMessage>;
  polls?: Record<string, StreamRoomPoll>;
  reactions?: Record<string, StreamRoomReaction>;
}

export interface UserRoomRecord {
  roomId: string;
  name: string;
  poster: string;
  creatorUid: string;
  joinedAt: number;
  lastVisited: number;
}

/**
 * Dispatch instant push notification to specific room members via Cloudflare Worker
 */
export async function notifyRoomMembers(
  targetUids: string[],
  notification: { title: string; body: string; url: string; icon?: string; image?: string }
): Promise<void> {
  if (!targetUids || targetUids.length === 0) return;
  try {
    await fetch(`${PUSH_WORKER_URL}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...notification,
        targetUids,
      }),
    });
  } catch (err) {
    console.warn('Failed to dispatch room push notification:', err);
  }
}

/**
 * Create a brand new stream room
 */
export async function createStreamRoom(
  user: { uid: string; displayName?: string | null; email?: string | null },
  profile: { name?: string; avatarIndex?: number; c1?: string; c2?: string } | null,
  name: string,
  poster: string
): Promise<string> {
  const roomsRef = ref(rtdb, 'watchrooms');
  const newRoomRef = push(roomsRef);
  const roomId = newRoomRef.key;
  if (!roomId) throw new Error('Failed to generate room id');

  const now = Date.now();
  const userName = profile?.name || user.displayName || 'MadHata Member';

  const memberData: StreamRoomMember = {
    uid: user.uid,
    name: userName,
    avatarIndex: profile?.avatarIndex ?? 0,
    c1: profile?.c1 || '#7928ca',
    c2: profile?.c2 || '#ff0080',
    isHost: true,
    online: true,
    joinedAt: now,
    lastSeen: now,
  };

  const initialRoom: Partial<StreamRoom> = {
    id: roomId,
    name: name.trim() || 'MadHata Watchroom',
    poster: poster || 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&auto=format&fit=crop&q=80',
    creatorUid: user.uid,
    creatorName: userName,
    createdAt: now,
    status: 'waiting',
    members: {
      [user.uid]: memberData,
    },
  };

  await set(newRoomRef, initialRoom);

  // Link to user's personal list of rooms
  const userRoomRecord: UserRoomRecord = {
    roomId,
    name: initialRoom.name || 'Watchroom',
    poster: initialRoom.poster || '',
    creatorUid: user.uid,
    joinedAt: now,
    lastVisited: now,
  };
  await set(ref(rtdb, `user_rooms/${user.uid}/${roomId}`), userRoomRecord);

  // Initial welcome message
  const msgRef = push(ref(rtdb, `watchrooms/${roomId}/messages`));
  await set(msgRef, {
    id: msgRef.key,
    senderUid: 'system',
    senderName: 'MadHata',
    text: `🎉 Room "${initialRoom.name}" created by ${userName}. Invite friends with the link!`,
    type: 'system',
    timestamp: now,
  });

  return roomId;
}

/**
 * Join an existing stream room
 */
export async function joinStreamRoom(
  roomId: string,
  user: { uid: string; displayName?: string | null },
  profile: { name?: string; avatarIndex?: number; c1?: string; c2?: string } | null
): Promise<StreamRoom | null> {
  const roomSnap = await get(ref(rtdb, `watchrooms/${roomId}`));
  if (!roomSnap.exists()) return null;

  const room = roomSnap.val() as StreamRoom;
  const now = Date.now();
  const userName = profile?.name || user.displayName || 'MadHata Member';

  const isCreator = room.creatorUid === user.uid;
  const memberData: StreamRoomMember = {
    uid: user.uid,
    name: userName,
    avatarIndex: profile?.avatarIndex ?? 0,
    c1: profile?.c1 || '#2f7cf6',
    c2: profile?.c2 || '#0d3fc4',
    isHost: isCreator,
    online: true,
    joinedAt: now,
    lastSeen: now,
  };

  // Add to room members
  await update(ref(rtdb, `watchrooms/${roomId}/members/${user.uid}`), memberData);

  // Set presence disconnect hook
  const memberOnlineRef = ref(rtdb, `watchrooms/${roomId}/members/${user.uid}/online`);
  onDisconnect(memberOnlineRef).set(false);

  // Add to user's personal joined list
  const userRoomRecord: UserRoomRecord = {
    roomId,
    name: room.name,
    poster: room.poster,
    creatorUid: room.creatorUid,
    joinedAt: now,
    lastVisited: now,
  };
  await set(ref(rtdb, `user_rooms/${user.uid}/${roomId}`), userRoomRecord);

  // Post join message if new
  if (!room.members || !room.members[user.uid]) {
    const msgRef = push(ref(rtdb, `watchrooms/${roomId}/messages`));
    await set(msgRef, {
      id: msgRef.key,
      senderUid: 'system',
      senderName: 'MadHata',
      text: `${userName} joined the room`,
      type: 'system',
      timestamp: now,
    });
  }

  return room;
}

/**
 * Leave a stream room
 */
export async function leaveStreamRoom(roomId: string, uid: string): Promise<void> {
  await remove(ref(rtdb, `user_rooms/${uid}/${roomId}`));
  await remove(ref(rtdb, `watchrooms/${roomId}/members/${uid}`));
}

/**
 * Remove / kick a member from the room (host action)
 */
export async function removeRoomMember(roomId: string, memberUid: string): Promise<void> {
  await remove(ref(rtdb, `watchrooms/${roomId}/members/${memberUid}`));
  await remove(ref(rtdb, `user_rooms/${memberUid}/${roomId}`));
}

/**
 * Send a flat text chat message in the stream room
 */
export async function sendRoomMessage(
  roomId: string,
  user: { uid: string; displayName?: string | null },
  profile: { name?: string; avatarIndex?: number; c1?: string; c2?: string } | null,
  text: string,
  roomName = 'Watchroom'
): Promise<void> {
  const clean = text.trim();
  if (!clean) return;

  const msgRef = push(ref(rtdb, `watchrooms/${roomId}/messages`));
  const now = Date.now();
  const userName = profile?.name || user.displayName || 'Member';

  const msg: StreamRoomMessage = {
    id: msgRef.key!,
    senderUid: user.uid,
    senderName: userName,
    avatarIndex: profile?.avatarIndex ?? 0,
    c1: profile?.c1,
    c2: profile?.c2,
    text: clean,
    type: 'text',
    timestamp: now,
  };

  await set(msgRef, msg);

  // Notify other members
  try {
    const memSnap = await get(ref(rtdb, `watchrooms/${roomId}/members`));
    if (memSnap.exists()) {
      const members = memSnap.val() as Record<string, StreamRoomMember>;
      const otherUids = Object.keys(members).filter((id) => id !== user.uid);
      if (otherUids.length > 0) {
        notifyRoomMembers(otherUids, {
          title: `💬 ${roomName}: ${userName}`,
          body: clean.length > 80 ? clean.slice(0, 80) + '...' : clean,
          url: `/stream-room/${roomId}`,
        });
      }
    }
  } catch {}
}

/**
 * Create a movie poll inside the room
 */
export async function createMoviePoll(
  roomId: string,
  user: { uid: string; displayName?: string | null },
  profile: { name?: string } | null,
  question: string,
  options: Array<{ title: string; poster: string; url: string; source: string }>,
  scheduledStartTime?: number | null,
  roomName = 'Watchroom'
): Promise<string> {
  const pollRef = push(ref(rtdb, `watchrooms/${roomId}/polls`));
  const pollId = pollRef.key!;
  const now = Date.now();
  const userName = profile?.name || user.displayName || 'Host';

  const pollOptions: StreamRoomPollOption[] = options.map((opt, idx) => ({
    id: `opt_${idx + 1}_${Date.now()}`,
    title: opt.title,
    poster: opt.poster,
    url: opt.url,
    source: opt.source || '1',
    votes: {},
  }));

  const poll: StreamRoomPoll = {
    id: pollId,
    creatorUid: user.uid,
    creatorName: userName,
    question: question.trim() || 'What are we watching?',
    options: pollOptions,
    active: true,
    scheduledStartTime: scheduledStartTime || null,
    winningOptionId: null,
    createdAt: now,
  };

  await set(pollRef, poll);
  await update(ref(rtdb, `watchrooms/${roomId}`), {
    status: 'voting',
    scheduledStartTime: scheduledStartTime || null,
  });

  // Post system notice in chat
  const msgRef = push(ref(rtdb, `watchrooms/${roomId}/messages`));
  await set(msgRef, {
    id: msgRef.key,
    senderUid: 'system',
    senderName: 'MadHata',
    text: `🗳️ ${userName} created a movie poll: "${poll.question}". Cast your vote below!`,
    type: 'system',
    timestamp: now,
  });

  // Notify members via push
  try {
    const memSnap = await get(ref(rtdb, `watchrooms/${roomId}/members`));
    if (memSnap.exists()) {
      const members = memSnap.val() as Record<string, StreamRoomMember>;
      const otherUids = Object.keys(members).filter((id) => id !== user.uid);
      if (otherUids.length > 0) {
        notifyRoomMembers(otherUids, {
          title: `🗳️ New Poll in ${roomName}`,
          body: `${userName} launched a movie vote: "${poll.question}"`,
          url: `/stream-room/${roomId}`,
          image: pollOptions[0]?.poster,
        });
      }
    }
  } catch {}

  return pollId;
}

/**
 * Cast a vote on a candidate show in a poll
 */
export async function voteInPoll(
  roomId: string,
  pollId: string,
  optionId: string,
  uid: string
): Promise<void> {
  const pollRef = ref(rtdb, `watchrooms/${roomId}/polls/${pollId}`);
  const snap = await get(pollRef);
  if (!snap.exists()) return;

  const poll = snap.val() as StreamRoomPoll;
  if (!poll.active || !Array.isArray(poll.options)) return;

  const updatedOptions = poll.options.map((opt) => {
    const existingVotes = { ...(opt.votes || {}) };
    delete existingVotes[uid]; // Remove prior vote if any
    if (opt.id === optionId) {
      existingVotes[uid] = true;
    }
    return {
      ...opt,
      votes: existingVotes,
    };
  });

  await update(pollRef, { options: updatedOptions });
}

/**
 * Close poll, set winning media, and schedule / start stream
 */
export async function finalizeWinningMedia(
  roomId: string,
  pollId: string,
  winningOption: StreamRoomPollOption,
  triggerPlayNow = false,
  roomName = 'Watchroom'
): Promise<void> {
  const now = Date.now();
  await update(ref(rtdb, `watchrooms/${roomId}/polls/${pollId}`), {
    active: false,
    winningOptionId: winningOption.id,
  });

  const mediaPayload = {
    id: winningOption.id,
    title: winningOption.title,
    poster: winningOption.poster,
    url: winningOption.url,
    source: winningOption.source,
  };

  const newStatus = triggerPlayNow ? 'playing' : 'scheduled';

  await update(ref(rtdb, `watchrooms/${roomId}`), {
    currentMedia: mediaPayload,
    status: newStatus,
    playback: {
      currentTime: 0,
      isPlaying: triggerPlayNow,
      updatedAt: now,
      updatedBy: 'host',
      mediaUrl: winningOption.url,
      mediaId: winningOption.id,
    },
  });

  // Post in chat
  const msgRef = push(ref(rtdb, `watchrooms/${roomId}/messages`));
  await set(msgRef, {
    id: msgRef.key,
    senderUid: 'system',
    senderName: 'MadHata',
    text: `🏆 Poll ended! Winning selection: "${winningOption.title}". ${triggerPlayNow ? 'Stream is starting now!' : 'Stream scheduled.'}`,
    type: 'system',
    timestamp: now,
  });

  // Notify members
  try {
    const memSnap = await get(ref(rtdb, `watchrooms/${roomId}/members`));
    if (memSnap.exists()) {
      const members = memSnap.val() as Record<string, StreamRoomMember>;
      const allUids = Object.keys(members);
      notifyRoomMembers(allUids, {
        title: triggerPlayNow ? `🍿 Stream Starting: ${roomName}` : `🏆 Winner Selected: ${winningOption.title}`,
        body: triggerPlayNow ? `Grab your popcorn! We are now watching ${winningOption.title}` : `Winning show is ${winningOption.title}`,
        url: triggerPlayNow 
          ? `/watch?room=${roomId}&url=${encodeURIComponent(winningOption.url)}&id=${encodeURIComponent(winningOption.id)}&title=${encodeURIComponent(winningOption.title)}`
          : `/stream-room/${roomId}`,
        image: winningOption.poster,
      });
    }
  } catch {}
}

/**
 * Record a reaction emoji with scene snapshot timestamp in room history
 */
export async function recordSceneReaction(
  roomId: string,
  uid: string,
  userName: string,
  emoji: string,
  sceneTime: string,
  mediaTitle?: string
): Promise<void> {
  const rxRef = push(ref(rtdb, `watchrooms/${roomId}/reactions`));
  const reaction: StreamRoomReaction = {
    id: rxRef.key!,
    uid,
    userName: userName || 'Viewer',
    emoji,
    timestamp: Date.now(),
    sceneTime,
    mediaTitle: mediaTitle || 'Movie',
  };

  await set(rxRef, reaction);
}

/**
 * Update real-time playback state for soft sync
 */
export async function updateRoomPlayback(
  roomId: string,
  currentTime: number,
  isPlaying: boolean,
  uid: string,
  mediaUrl?: string
): Promise<void> {
  await update(ref(rtdb, `watchrooms/${roomId}/playback`), {
    currentTime,
    isPlaying,
    updatedAt: Date.now(),
    updatedBy: uid,
    ...(mediaUrl ? { mediaUrl } : {}),
  });
}

/**
 * Listen to user's joined rooms
 */
export function listenToUserRooms(
  uid: string,
  callback: (rooms: UserRoomRecord[]) => void
): Unsubscribe {
  const userRoomsRef = ref(rtdb, `user_rooms/${uid}`);
  return onValue(userRoomsRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }
    const val = snapshot.val();
    const list: UserRoomRecord[] = Object.values(val);
    list.sort((a, b) => (b.lastVisited || b.joinedAt) - (a.lastVisited || a.joinedAt));
    callback(list);
  });
}

/**
 * Listen to single stream room
 */
export function listenToStreamRoom(
  roomId: string,
  callback: (room: StreamRoom | null) => void
): Unsubscribe {
  const roomRef = ref(rtdb, `watchrooms/${roomId}`);
  return onValue(roomRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    callback(snapshot.val() as StreamRoom);
  });
}
