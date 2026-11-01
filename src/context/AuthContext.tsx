import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signOut as fbSignOut 
} from 'firebase/auth';
import { ref, get, set, update, DataSnapshot } from 'firebase/database';
import { auth, rtdb } from '../firebase.ts';

export interface UserProfile {
  name: string;
  email: string;
  avatarIndex: number;
  c1: string;
  c2: string;
  updatedAt?: number;
  createdAt?: number;
}

export interface CachedAuthData {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  profile: UserProfile | null;
  cachedAt: number;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isOffline: boolean;
  logout: () => Promise<void>;
  updateUserProfile: (profileData: Partial<UserProfile>) => Promise<void>;
}

const AUTH_CACHE_KEY = 'madhata_auth_cache';

export const AVATAR_PALETTE: [string, string][] = [
  ['#2f7cf6', '#0d3fc4'],
  ['#ff6a6f', '#c1182c'],
  ['#ffc533', '#e0850a'],
  ['#2fd08a', '#0b8352'],
  ['#8a6bff', '#3b2fd0'],
];

// Helper to safely read cached authentication from localStorage
const loadCachedAuth = (): CachedAuthData | null => {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedAuthData;
  } catch (e) {
    console.error('Failed to parse cached auth state:', e);
    return null;
  }
};

// Helper to save authentication state into localStorage
const saveCachedAuth = (user: User | null, profile: UserProfile | null) => {
  if (!user) {
    localStorage.removeItem(AUTH_CACHE_KEY);
    return;
  }
  try {
    const data: CachedAuthData = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      profile,
      cachedAt: Date.now(),
    };
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save cached auth state:', e);
  }
};

// Helper to create a compliant User object from cached credentials when offline
const createSyntheticUser = (data: CachedAuthData): User => {
  return {
    uid: data.uid,
    email: data.email,
    displayName: data.displayName,
    photoURL: data.photoURL,
    emailVerified: true,
    isAnonymous: false,
    metadata: {},
    providerData: [],
    refreshToken: '',
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => '',
    getIdTokenResult: async () => ({} as any),
    reload: async () => {},
    toJSON: () => ({}),
    phoneNumber: null,
    providerId: 'firebase',
  } as unknown as User;
};

// Helper to wrap database get with a strict timeout to prevent indefinite hanging while offline
const getWithTimeout = async (dbRef: any, timeoutMs = 2500): Promise<DataSnapshot | null> => {
  return Promise.race([
    get(dbRef).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
  logout: async () => {},
  updateUserProfile: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Synchronously hydrate from cache immediately on startup
  const initialCache = typeof window !== 'undefined' ? loadCachedAuth() : null;
  const initialOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;

  const [user, setUser] = useState<User | null>(() => {
    if (initialCache) {
      return createSyntheticUser(initialCache);
    }
    // If offline and no cache, fallback offline profile
    if (initialOffline) {
      return createSyntheticUser({
        uid: 'offline_user',
        email: 'offline@madhata.local',
        displayName: 'Offline Viewer',
        photoURL: null,
        profile: {
          name: 'Offline Viewer',
          email: 'offline@madhata.local',
          avatarIndex: 0,
          c1: AVATAR_PALETTE[0][0],
          c2: AVATAR_PALETTE[0][1],
        },
        cachedAt: Date.now(),
      });
    }
    return null;
  });

  const [profile, setProfile] = useState<UserProfile | null>(() => {
    if (initialCache) return initialCache.profile;
    if (initialOffline) {
      return {
        name: 'Offline Viewer',
        email: 'offline@madhata.local',
        avatarIndex: 0,
        c1: AVATAR_PALETTE[0][0],
        c2: AVATAR_PALETTE[0][1],
      };
    }
    return null;
  });

  // If we already have a cached user, avoid blocking the screen indefinitely
  const [loading, setLoading] = useState<boolean>(!initialCache && !initialOffline);
  const [isOffline, setIsOffline] = useState<boolean>(initialOffline);

  // Keep ref up to date for background worker intervals
  const profileRef = useRef<UserProfile | null>(profile);
  profileRef.current = profile;

  const userRef = useRef<User | null>(user);
  userRef.current = user;

  // Maximum preloader safety timer (3 to 5 seconds)
  useEffect(() => {
    const PRELOADER_TIMEOUT_MS = 3500; // 3.5 seconds
    const safetyTimer = setTimeout(() => {
      setLoading(false);
      // If offline and no user, hydrate with offline fallback
      if (!navigator.onLine && !userRef.current) {
        const cached = loadCachedAuth();
        if (cached) {
          setUser(createSyntheticUser(cached));
          setProfile(cached.profile);
        } else {
          const offlineFallback: CachedAuthData = {
            uid: 'offline_user',
            email: 'offline@madhata.local',
            displayName: 'Offline Viewer',
            photoURL: null,
            profile: {
              name: 'Offline Viewer',
              email: 'offline@madhata.local',
              avatarIndex: 0,
              c1: AVATAR_PALETTE[0][0],
              c2: AVATAR_PALETTE[0][1],
            },
            cachedAt: Date.now(),
          };
          setUser(createSyntheticUser(offlineFallback));
          setProfile(offlineFallback.profile);
        }
      }
    }, PRELOADER_TIMEOUT_MS);

    return () => clearTimeout(safetyTimer);
  }, []);

  // Listen to Firebase live auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        let fetchedProfile: UserProfile | null = null;
        try {
          const userRefDb = ref(rtdb, `users/${currentUser.uid}/profile`);
          const snapshot = await getWithTimeout(userRefDb, 2500);
          if (snapshot && snapshot.exists && snapshot.exists()) {
            fetchedProfile = snapshot.val() as UserProfile;
          } else if (profileRef.current) {
            fetchedProfile = profileRef.current;
          } else {
            const defaultProfile: UserProfile = {
              name: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
              email: currentUser.email || '',
              avatarIndex: 0,
              c1: AVATAR_PALETTE[0][0],
              c2: AVATAR_PALETTE[0][1],
              createdAt: Date.now(),
            };
            if (navigator.onLine) {
              set(userRefDb, defaultProfile).catch(() => {});
            }
            fetchedProfile = defaultProfile;
          }
        } catch (err) {
          console.warn('Error fetching user profile from RTDB (using cache/fallback):', err);
          fetchedProfile = profileRef.current || {
            name: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
            email: currentUser.email || '',
            avatarIndex: 0,
            c1: AVATAR_PALETTE[0][0],
            c2: AVATAR_PALETTE[0][1],
          };
        }

        setProfile(fetchedProfile);
        saveCachedAuth(currentUser, fetchedProfile);
      } else {
        // Only clear user if device is actually online
        if (navigator.onLine) {
          setUser(null);
          setProfile(null);
          saveCachedAuth(null, null);
        } else {
          // While offline, retain cached authentication
          const cached = loadCachedAuth();
          if (cached) {
            setUser(createSyntheticUser(cached));
            setProfile(cached.profile);
          }
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Background Worker: 5-minute periodic caching interval
  useEffect(() => {
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const intervalId = setInterval(() => {
      if (navigator.onLine && auth.currentUser) {
        // Silently verify token in background
        auth.currentUser.getIdToken(false)
          .then(() => {
            // Token is active, refresh the cached state
            saveCachedAuth(auth.currentUser, profileRef.current);
          })
          .catch((err) => {
            console.warn('Background 5-minute auth verification detected invalid session:', err);
            if (err?.code === 'auth/user-token-expired' || err?.code === 'auth/user-disabled') {
              logout();
            }
          });
      } else if (userRef.current && profileRef.current) {
        // Offline or standby: refresh local timestamp cache
        saveCachedAuth(userRef.current, profileRef.current);
      }
    }, FIVE_MINUTES_MS);

    return () => clearInterval(intervalId);
  }, []);

  // Background Worker: Reconnect / Online / Offline event listener
  useEffect(() => {
    const handleOnline = async () => {
      setIsOffline(false);
      // Smart background sync without page reload or interrupting the user
      if (auth.currentUser) {
        try {
          await auth.currentUser.getIdToken(false);
          // Token is valid! Silently update RTDB profile in background
          const userRefDb = ref(rtdb, `users/${auth.currentUser.uid}/profile`);
          const snapshot = await getWithTimeout(userRefDb, 3000);
          if (snapshot && snapshot.exists && snapshot.exists()) {
            const liveProfile = snapshot.val() as UserProfile;
            setProfile(liveProfile);
            saveCachedAuth(auth.currentUser, liveProfile);
          } else {
            saveCachedAuth(auth.currentUser, profileRef.current);
          }
        } catch (err: any) {
          console.warn('Live auth session invalid on reconnect:', err);
          if (err?.code === 'auth/user-token-expired' || err?.code === 'auth/user-disabled' || err?.code === 'auth/invalid-user-token') {
            await logout();
          }
        }
      } else {
        // Check if onAuthStateChanged indicates no user while online
        if (userRef.current && userRef.current.uid === 'offline_user') {
          // If we were using temporary offline user, prompt for login now that we're online
          setUser(null);
          setProfile(null);
          localStorage.removeItem(AUTH_CACHE_KEY);
        }
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
      // Guarantee current state is cached for offline use
      if (userRef.current && profileRef.current) {
        saveCachedAuth(userRef.current, profileRef.current);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const logout = async () => {
    try {
      await fbSignOut(auth);
    } catch (e) {
      console.warn('Sign out error:', e);
    }
    setUser(null);
    setProfile(null);
    localStorage.removeItem(AUTH_CACHE_KEY);
  };

  const updateUserProfile = async (profileData: Partial<UserProfile>) => {
    if (!user) return;
    const updatedProfile = profile ? { ...profile, ...profileData } : null;
    setProfile(updatedProfile);
    saveCachedAuth(user, updatedProfile);

    if (navigator.onLine && user.uid !== 'offline_user') {
      try {
        const userRefDb = ref(rtdb, `users/${user.uid}/profile`);
        await update(userRefDb, {
          ...profileData,
          updatedAt: Date.now(),
        });
      } catch (err) {
        console.error('Error updating user profile in RTDB:', err);
        throw err;
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isOffline, logout, updateUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
