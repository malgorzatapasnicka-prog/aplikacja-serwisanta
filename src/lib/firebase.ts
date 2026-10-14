"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { firebaseConfig, isFirebaseConfigured } from "@/lib/firebaseConfig";

let firestore: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) {
    return null;
  }

  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

/** Firestore do kolekcji `klienci` i `zlecenia`. Zwraca null, dopóki klucze nie są wklejone. */
export function getDb(): Firestore | null {
  if (!isFirebaseConfigured()) {
    return null;
  }

  if (!firestore) {
    const app = getFirebaseApp();
    if (!app) {
      return null;
    }
    firestore = getFirestore(app);
  }

  return firestore;
}
