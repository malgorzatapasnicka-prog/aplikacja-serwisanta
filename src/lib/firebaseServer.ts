import { deleteApp, initializeServerApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { firebaseConfig, isFirebaseConfigured } from "@/lib/firebaseConfig";

export function tokenZNaglowka(request: Request) {
  const naglowek = request.headers.get("authorization") ?? "";
  const dopasowanie = /^Bearer\s+(\S+)$/i.exec(naglowek.trim());
  return dopasowanie?.[1] ?? "";
}

/**
 * Firestore na serwerze z sesją serwisanta.
 * Token z nagłówka Authorization sprawia, że reguły widzą request.auth.
 */
export async function otworzBazeSerwera(idToken: string): Promise<{ db: Firestore; zamknij: () => Promise<void> } | null> {
  if (!isFirebaseConfigured() || !idToken) {
    return null;
  }

  const app = initializeServerApp(firebaseConfig, { authIdToken: idToken });
  try {
    const auth = getAuth(app);
    await auth.authStateReady();
    if (!auth.currentUser) {
      await deleteApp(app);
      return null;
    }

    return {
      db: getFirestore(app),
      zamknij: () => deleteApp(app),
    };
  } catch (error) {
    await deleteApp(app).catch(() => undefined);
    throw error;
  }
}
