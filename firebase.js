import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDEMlrXAFlBTWEg5Yhp1n12k-M5DiFXPEM",
  authDomain: "projet-paris-6bf57.firebaseapp.com",
  projectId: "projet-paris-6bf57",
  storageBucket: "projet-paris-6bf57.firebasestorage.app",
  messagingSenderId: "175375609643",
  appId: "1:175375609643:web:e4ffde79abe0d96d091f6e",
  measurementId: "G-01ELWE93FK"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Analytics (safely checks browser support)
let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

// Initialize Services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, analytics, auth, db, storage, firebaseConfig };
export default app;
