import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Validar que las variables de entorno requeridas existan
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

const missingVars = requiredEnvVars.filter(
  varName => !import.meta.env[varName]
);

if (missingVars.length > 0) {
  throw new Error(
    `Firebase configuration incomplete. Missing environment variables: ${missingVars.join(', ')}. ` +
    `Copy .env.example to .env.local and fill in the required values.`
  );
}

// Configuración de Firebase desde variables de entorno
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined
};

// Fallback para configuración global inyectada (para deployments especiales)
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
