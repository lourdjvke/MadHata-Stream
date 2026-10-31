import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signOut as fbSignOut 
} from 'firebase/auth';
import { ref, get, set, update } from 'firebase/database';
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

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  updateUserProfile: (profileData: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  logout: async () => {},
  updateUserProfile: async () => {},
});

export const AVATAR_PALETTE: [string, string][] = [
  ['#2f7cf6', '#0d3fc4'],
  ['#ff6a6f', '#c1182c'],
  ['#ffc533', '#e0850a'],
  ['#2fd08a', '#0b8352'],
  ['#8a6bff', '#3b2fd0'],
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userRef = ref(rtdb, `users/${currentUser.uid}/profile`);
          const snapshot = await get(userRef);
          if (snapshot.exists()) {
            setProfile(snapshot.val() as UserProfile);
          } else {
            // Default profile if none found in RTDB
            const defaultProfile: UserProfile = {
              name: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
              email: currentUser.email || '',
              avatarIndex: 0,
              c1: AVATAR_PALETTE[0][0],
              c2: AVATAR_PALETTE[0][1],
              createdAt: Date.now(),
            };
            await set(userRef, defaultProfile);
            setProfile(defaultProfile);
          }
        } catch (err) {
          console.error('Error fetching user profile from RTDB:', err);
          setProfile({
            name: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
            email: currentUser.email || '',
            avatarIndex: 0,
            c1: AVATAR_PALETTE[0][0],
            c2: AVATAR_PALETTE[0][1],
          });
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await fbSignOut(auth);
    setUser(null);
    setProfile(null);
  };

  const updateUserProfile = async (profileData: Partial<UserProfile>) => {
    if (!user) return;
    try {
      const userRef = ref(rtdb, `users/${user.uid}/profile`);
      await update(userRef, {
        ...profileData,
        updatedAt: Date.now(),
      });
      setProfile((prev) => (prev ? { ...prev, ...profileData } : null));
    } catch (err) {
      console.error('Error updating user profile in RTDB:', err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout, updateUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
