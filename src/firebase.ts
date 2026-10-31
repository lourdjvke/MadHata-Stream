import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// Web app's Firebase configuration provided by user
export const firebaseConfig = {
  apiKey: "AIzaSyDwzGcMkajwSCDJLijAO4HF73fH6ypAY-0",
  authDomain: "madhata-dcfef.firebaseapp.com",
  databaseURL: "https://madhata-dcfef-default-rtdb.firebaseio.com",
  projectId: "madhata-dcfef",
  storageBucket: "madhata-dcfef.firebasestorage.app",
  messagingSenderId: "215226905270",
  appId: "1:215226905270:web:a90146d4e785c17600ac17",
  measurementId: "G-2B8MWXZ168"
};

// Initialize Firebase safely
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const rtdb = getDatabase(app);

export default app;
