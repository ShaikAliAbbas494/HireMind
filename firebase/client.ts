// firebase/client.ts

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyD_9594sO7fkwJ-x33XG0mdSsJv-Vv2JWs",
  authDomain: "hire-mind-dc2ab.firebaseapp.com",
  projectId: "hire-mind-dc2ab",
  storageBucket: "hire-mind-dc2ab.firebasestorage.app",
  messagingSenderId: "158557074384",
  appId: "1:158557074384:web:86aa9d9a50a233edddbfd5",
  measurementId: "G-4RN46KZG5F",
};

// ✅ Initialize app only once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// ✅ Auth is safe everywhere
export const auth = getAuth(app);

// ✅ Analytics ONLY in browser
export const analytics =
  typeof window !== "undefined"
    ? isSupported().then((yes) => (yes ? getAnalytics(app) : null))
    : null;
