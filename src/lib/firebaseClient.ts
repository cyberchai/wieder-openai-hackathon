import { initializeApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getAnalytics, isSupported as analyticsIsSupported, Analytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const missingKeys = ["apiKey", "authDomain", "projectId", "appId"].filter(
  (key) => !(firebaseConfig as Record<string, string | undefined>)[key],
);

if (missingKeys.length) {
  throw new Error(`Missing Firebase configuration environment variables: ${missingKeys.join(", ")}`);
}

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
        } catch {
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
