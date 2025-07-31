// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "TODO:_REPLACE_WITH_YOUR_FIREBASE_API_KEY",
  authDomain: "TODO:_REPLACE_WITH_YOUR_FIREBASE_AUTH_DOMAIN",
  projectId: "TODO:_REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID",
  storageBucket: "TODO:_REPLACE_WITH_YOUR_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "TODO:_REPLACE_WITH_YOUR_FIREBASE_MESSAGING_SENDER_ID",
  appId: "TODO:_REPLACE_WITH_YOUR_FIREBASE_APP_ID"
};

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
