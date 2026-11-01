"use client";

import {
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
  type QuerySnapshot,
} from "firebase/firestore";

/** Jak długo czekamy na potwierdzenie z serwera, gdy telefon myśli, że ma internet. */
const CZAS_NA_POTWIERDZENIE_ONLINE_MS = 5000;
/** Offline czekamy tylko tyle, żeby wyłapać natychmiastowe błędy (np. niepoprawne dane). */
const CZAS_NA_BLAD_OFFLINE_MS = 300;

export function brakSieci() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * Firestore zapisuje dane od razu w pamięci telefonu, ale obietnica z setDoc/addDoc/updateDoc/deleteDoc
 * kończy się dopiero po potwierdzeniu przez serwer. Bez internetu to oznaczałoby zawieszony formularz.
 *
 * Zwraca true, gdy serwer potwierdził zapis, a false, gdy zapis czeka w kolejce telefonu
 * i wyśle się sam po odzyskaniu sieci. Błędy zgłoszone od razu (np. brak uprawnień) są rzucane dalej.
 */
export function zapiszBezCzekania(zapis: Promise<unknown>): Promise<boolean> {
  return new Promise((resolve, reject) => {
    let zakonczone = false;
    const limit = setTimeout(
      () => {
        zakonczone = true;
        resolve(false);
      },
      brakSieci() ? CZAS_NA_BLAD_OFFLINE_MS : CZAS_NA_POTWIERDZENIE_ONLINE_MS,
    );

    zapis.then(
      () => {
        clearTimeout(limit);
        if (!zakonczone) {
          zakonczone = true;
          resolve(true);
        }
      },
      (error: unknown) => {
        clearTimeout(limit);
        if (zakonczone) {
          console.error("Zapis czekający w kolejce został odrzucony przez serwer:", error);
          return;
        }
        zakonczone = true;
        reject(error);
      },
    );
  });
}

/** Odczyt dokumentu: bez sieci od razu z pamięci telefonu. */
export async function odczytDokumentu<T>(ref: DocumentReference<T>): Promise<DocumentSnapshot<T>> {
  if (brakSieci()) {
    try {
      return await getDocFromCache(ref);
    } catch {
      // brak w pamięci telefonu, próbujemy normalnie
    }
  }
  return getDoc(ref);
}

/** Odczyt zapytania: bez sieci od razu z pamięci telefonu. */
export async function odczytZapytania<T>(zapytanie: Query<T>): Promise<QuerySnapshot<T>> {
  if (brakSieci()) {
    try {
      return await getDocsFromCache(zapytanie);
    } catch {
      // brak w pamięci telefonu, próbujemy normalnie
    }
  }
  return getDocs(zapytanie);
}

export const KOMUNIKAT_ZAPISANO_OFFLINE = "Brak internetu. Dane zapisano w telefonie i wyślą się automatycznie po odzyskaniu sieci.";
