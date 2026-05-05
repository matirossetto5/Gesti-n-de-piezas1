import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuration from environment variables (secure)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDr4CgSmWarlLqcjTMV9NLAfX7RgRuE9Hc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gestion-de-piezas-9baf6.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gestion-de-piezas-9baf6",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gestion-de-piezas-9baf6.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "522730585054",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:522730585054:web:1f3d4601e08ecaf395fb4f"
};

// Use global config if injected (fallback to local)
const configToUse = (typeof (window as any).__firebase_config !== 'undefined')
  ? JSON.parse((window as any).__firebase_config)
  : firebaseConfig;

try {
  const app = initializeApp(configToUse);
  export const auth = getAuth(app);
  export const db = getFirestore(app);
  export const appId = (typeof (window as any).__app_id !== 'undefined')
    ? (window as any).__app_id
    : (configToUse.projectId || 'default');
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  throw error;
}
