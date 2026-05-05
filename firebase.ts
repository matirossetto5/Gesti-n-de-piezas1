import { initializeApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

// Configuration from environment variables (REQUIRED - no hardcoded fallback)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Validate that all required environment variables are present
const requiredEnvVars = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'] as const;
const missingVars = requiredEnvVars.filter(key => !firebaseConfig[key]);

if (missingVars.length > 0) {
  throw new Error(
    `Firebase configuration incomplete. Missing environment variables: ${missingVars.join(', ')}. ` +
    `Please set VITE_FIREBASE_* environment variables in .env.local or Netlify configuration.`
  );
}

// Use global config if injected (fallback to local)
const configToUse = (typeof (window as any).__firebase_config !== 'undefined')
  ? JSON.parse((window as any).__firebase_config)
  : firebaseConfig;

// Declare exports at module level
let auth: Auth;
let db: Firestore;
let appId: string;

try {
  const app = initializeApp(configToUse);
  auth = getAuth(app);
  db = getFirestore(app);
  appId = (typeof (window as any).__app_id !== 'undefined')
    ? (window as any).__app_id
    : (configToUse.projectId || 'default');
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  throw error;
}

export { auth, db, appId };
