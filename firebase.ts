import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Config provided by the user's original code
const firebaseConfig = {
  apiKey: "AIzaSyDtFio7d5DSgeaVQdyOMTO98xpKtQuF52s",
  authDomain: "gestion-de-piezas-fefdc.firebaseapp.com",
  projectId: "gestion-de-piezas-fefdc",
  storageBucket: "gestion-de-piezas-fefdc.appspot.com",
  messagingSenderId: "108463748099",
  appId: "1:108463748099:web:a5c0f1fdd5507fc45c8a36",
  measurementId: "G-D02SFWZYYM"
};

// Use global config if injected (fallback to local)
const configToUse = (typeof (window as any).__firebase_config !== 'undefined') 
  ? JSON.parse((window as any).__firebase_config) 
  : firebaseConfig;

const app = initializeApp(configToUse);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const appId = (typeof (window as any).__app_id !== 'undefined') 
  ? (window as any).__app_id 
  : (configToUse.projectId || 'default');
