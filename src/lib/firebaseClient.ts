import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getAnalytics, isSupported as analyticsIsSupported, Analytics } from "firebase/analytics";

// Prefer environment variables (NEXT_PUBLIC_) but fall back to the provided static config when missing.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCZeAtbfbzTR2-BwUTsbi8phIGM9Ctob5Q",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "openaihackathon-8f7ab.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "openaihackathon-8f7ab",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "openaihackathon-8f7ab.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "163737197027",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:163737197027:web:3541fe3c74810efa48e8d6",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-935S8FHZ0R",
};

export const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize analytics only in the browser and only if supported.
let analytics: Analytics | null = null;
if (typeof window !== "undefined") {
  // analytics may not be supported in all environments (SSR, older browsers)
  analyticsIsSupported()
    .then((supported) => {
      if (supported) {
        try {
          analytics = getAnalytics(app);
        } catch (e) {
          // ignore analytics failure (e.g., blocked by user or unavailable)
          analytics = null;
        }
      }
    })
    .catch(() => {
      analytics = null;
    });
}

export { signInWithPopup, signOut, onAuthStateChanged };
export { analytics };
