import type { FirebaseOptions } from "firebase/app";

/**
 * Wklej tutaj konfigurację z konsoli Firebase.
 *
 * Firebase Console → ikona koła zębatego → Ustawienia projektu → Ogólne
 * → Twoje aplikacje → Konfiguracja pakietu SDK → wybierz „Config”.
 *
 * Podmień wartości poniżej na te z konsoli. Klucze aplikacji webowej
 * są widoczne w przeglądarce — dostęp do danych ogranicz regułami Firestore.
 */
export const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyDUVg5fdN2CROJ9H3yhtqW-0TQYnQtQ4ug",
  authDomain: "aplikacja-serwisant.firebaseapp.com",
  projectId: "aplikacja-serwisant",
  storageBucket: "aplikacja-serwisant.firebasestorage.app",
  messagingSenderId: "470601814786",
  appId: "1:470601814786:web:f02db43bae8100ca76e81b",
  measurementId: "G-P24PFL8Y3F",
};

const PLACEHOLDER_PREFIX = "WKLEJ_";

export function isFirebaseConfigured(): boolean {
  const { apiKey, projectId } = firebaseConfig;

  return (
    typeof apiKey === "string" &&
    apiKey.length > 0 &&
    !apiKey.startsWith(PLACEHOLDER_PREFIX) &&
    typeof projectId === "string" &&
    projectId.length > 0 &&
    !projectId.startsWith(PLACEHOLDER_PREFIX)
  );
}
