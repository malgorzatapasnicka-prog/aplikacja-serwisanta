"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, type Firestore } from "firebase/firestore";
import { firebaseConfig, isFirebaseConfigured } from "@/lib/firebaseConfig";

let firestore: Firestore | null = null;
let logowanieZEnv: Promise<boolean> | null = null;

const KLUCZ_POMIN_AUTO = "pominAutoLogowanie";

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) {
    return null;
  }

  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

export function authAplikacji() {
  const app = getFirebaseApp();
  return app ? getAuth(app) : null;
}

export async function tokenSesji() {
  const token = await authAplikacji()?.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Brak sesji serwisanta. Zaloguj się ponownie.");
  }
  return token;
}

export function oznaczWylogowanieReczne() {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(KLUCZ_POMIN_AUTO, "1");
  }
}

export function wyczyscWylogowanieReczne() {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(KLUCZ_POMIN_AUTO);
  }
}

function pominieteAutoLogowanie() {
  return typeof sessionStorage !== "undefined" && sessionStorage.getItem(KLUCZ_POMIN_AUTO) === "1";
}

/** Loguje serwisanta z NEXT_PUBLIC_SERVICE_EMAIL i NEXT_PUBLIC_SERVICE_PASSWORD, gdy nie ma sesji. */
export function zalogujSerwisantaZEnv(): Promise<boolean> | null {
  const auth = authAplikacji();
  if (!auth || auth.currentUser || pominieteAutoLogowanie()) {
    return null;
  }

  const email = process.env.NEXT_PUBLIC_SERVICE_EMAIL?.trim() ?? "";
  const password = process.env.NEXT_PUBLIC_SERVICE_PASSWORD ?? "";
  if (!email || !password) {
    return null;
  }

  if (!logowanieZEnv) {
    logowanieZEnv = signInWithEmailAndPassword(auth, email, password)
      .then(() => true)
      .catch((error: unknown) => {
        logowanieZEnv = null;
        throw error;
      });
  }

  return logowanieZEnv;
}

/** Firestore tylko przy aktywnej sesji, żeby reguły widziały request.auth. */
export function getDb(): Firestore | null {
  if (!isFirebaseConfigured()) {
    return null;
  }

  const app = getFirebaseApp();
  if (!app || !getAuth(app).currentUser) {
    return null;
  }

  if (!firestore) {
    firestore = initializeFirestore(app, {
      localCache: persistentLocalCache(),
    });
  }

  return firestore;
}

/** Uruchamia odczyt Firestore dopiero, gdy auth.currentUser jest ustawiony. */
export function gdySesjaAktywna(uruchom: (db: Firestore) => void | (() => void)): () => void {
  const auth = authAplikacji();
  if (!auth) {
    return () => {};
  }

  let zatrzymajZapytanie = () => {};
  const zatrzymajNasluch = onAuthStateChanged(auth, (user) => {
    zatrzymajZapytanie();
    zatrzymajZapytanie = () => {};
    if (!user) {
      return;
    }

    const db = getDb();
    if (!db) {
      return;
    }

    const wynik = uruchom(db);
    if (typeof wynik === "function") {
      zatrzymajZapytanie = wynik;
    }
  });

  return () => {
    zatrzymajNasluch();
    zatrzymajZapytanie();
  };
}
