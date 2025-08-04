// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  "projectId": "map-explorer-yl700",
  "appId": "1:543799482543:web:cc17073468a2f24af49c5a",
  "storageBucket": "map-explorer-yl700.firebasestorage.app",
  "apiKey": "AIzaSyCPIRZLKaEzw202KRcFFA2e61XqOwdo91k",
  "authDomain": "map-explorer-yl700.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "543799482543"
};

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
