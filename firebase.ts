import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuration from environment variables (secure)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDtFio7d5DSgeaVQdyOMTO98xpKtQuF52s",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gestion-de-piezas-fefdc.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gestion-de-piezas-fefdc",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gestion-de-piezas-fefdc.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "108463748099",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:108463748099:web:a5c0f1fdd5507fc45c8a36",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-D02SFWZYYM"
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
