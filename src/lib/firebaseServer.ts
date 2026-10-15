import { getApps, initializeApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { firebaseConfig, isFirebaseConfigured } from "@/lib/firebaseConfig";

const NAZWA_APLIKACJI = "serwer";

export function getServerDb(): Firestore | null {
  if (!isFirebaseConfigured()) {
    return null;
  }

  const istniejaca = getApps().find((app) => app.name === NAZWA_APLIKACJI);
  const app = istniejaca ?? initializeApp(firebaseConfig, NAZWA_APLIKACJI);
  return getFirestore(app);
}
