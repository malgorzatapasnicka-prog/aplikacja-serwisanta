import { deleteApp, initializeApp, initializeServerApp } from "firebase/app";
import { getAuth, inMemoryPersistence, initializeAuth, signInWithEmailAndPassword } from "firebase/auth";
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

function daneLogowaniaSerwisanta() {
  const email = process.env.SERVICE_EMAIL?.trim() || process.env.NEXT_PUBLIC_SERVICE_EMAIL?.trim() || "";
  const haslo = process.env.SERVICE_PASSWORD || process.env.NEXT_PUBLIC_SERVICE_PASSWORD || "";
  return email && haslo ? { email, haslo } : null;
}

/**
 * Firestore na serwerze bez sesji z przeglądarki (np. codzienna wysyłka SMS).
 * Loguje konto serwisanta z SERVICE_EMAIL / SERVICE_PASSWORD,
 * a gdy ich nie ma — z NEXT_PUBLIC_SERVICE_EMAIL / NEXT_PUBLIC_SERVICE_PASSWORD.
 */
export async function otworzBazeSerwisanta(): Promise<{ db: Firestore; zamknij: () => Promise<void> } | null> {
  const logowanie = daneLogowaniaSerwisanta();
  if (!isFirebaseConfigured() || !logowanie) {
    return null;
  }

  const app = initializeApp(firebaseConfig, `serwisant-${crypto.randomUUID()}`);
  try {
    const auth = initializeAuth(app, { persistence: inMemoryPersistence });
    await signInWithEmailAndPassword(auth, logowanie.email, logowanie.haslo);
    return {
      db: getFirestore(app),
      zamknij: () => deleteApp(app),
    };
  } catch (error) {
    await deleteApp(app).catch(() => undefined);
    throw error;
  }
}
