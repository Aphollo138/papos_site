import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBc5MaD-riO2VOEeha3OIY9hz0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "papo-net.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "papo-net",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "papo-net.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "344762176006",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:344762176006:web:ff73eb56d882c4e8d4e987",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-GFNMN47DSF"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || "(default)";
const db = getFirestore(app, databaseId);

let analytics = null;

if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {
    // Gracefully handle environments without Analytics support
  });
}

export { app, auth, db, analytics };
