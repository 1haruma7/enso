import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

let cachedApp = null;
let cachedDb = null;
let cachedAuth = null;

function getFirebaseConfig() {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };

  const hasAllValues = Object.values(config).every(
    (value) => typeof value === "string" && value.length > 0
  );
  return hasAllValues ? config : null;
}

export function getFirebaseApp() {
  if (cachedApp) return cachedApp;

  const config = getFirebaseConfig();
  if (!config) {
    console.warn("Firebase config is missing. Set VITE_FIREBASE_* env vars.");
    return null;
  }

  cachedApp = getApps().length ? getApps()[0] : initializeApp(config);
  return cachedApp;
}

export function getDb() {
  if (cachedDb) return cachedDb;

  const app = getFirebaseApp();
  if (!app) return null;

  cachedDb = getFirestore(app);
  return cachedDb;
}

export function getAuthClient() {
  if (cachedAuth) return cachedAuth;

  const app = getFirebaseApp();
  if (!app) return null;

  cachedAuth = getAuth(app);
  cachedAuth.languageCode = "ja";
  return cachedAuth;
}
