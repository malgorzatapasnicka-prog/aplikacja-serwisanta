"use client";

import { FirebaseError } from "firebase/app";
import { deleteField, doc, updateDoc } from "firebase/firestore";
import { getDownloadURL, getStorage, ref, uploadString } from "firebase/storage";
import { KOLEKCJE } from "@/lib/collections";
import { getDb, getFirebaseApp } from "@/lib/firebase";
import { brakSieci, zapiszBezCzekania } from "@/lib/zapisOffline";

/** Zdarzenie okna, które informuje interfejs, że kolejka plików się zmieniła. */
export const ZDARZENIE_KOLEJKI = "kolejka-plikow-zmieniona";

const NAZWA_BAZY = "kolejka-plikow";
const NAZWA_STORE = "protokoly";
/** Po tylu sekundach nieudana wysyłka do Storage kończy się błędem zamiast czekać 10 minut. */
const MAKS_CZAS_WYSYLKI_MS = 20_000;

export type PlikiProtokoluWKolejce = {
  /** id protokołu (klucz w kolejce) */
  id: string;
  klientId: string;
  zdjecia: { src: string; podpis: string }[];
  /** data URL załącznika PDF albo pusty tekst */
  zalacznikPdf: string;
};

function otworzBaze(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Ta przeglądarka nie pozwala zapisać zdjęć w telefonie."));
      return;
    }
    const zadanie = indexedDB.open(NAZWA_BAZY, 1);
    zadanie.onupgradeneeded = () => {
      zadanie.result.createObjectStore(NAZWA_STORE, { keyPath: "id" });
    };
    zadanie.onsuccess = () => resolve(zadanie.result);
    zadanie.onerror = () => reject(zadanie.error ?? new Error("Nie udało się otworzyć pamięci telefonu."));
  });
}

async function wykonaj<T>(tryb: IDBTransactionMode, dzialanie: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const baza = await otworzBaze();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transakcja = baza.transaction(NAZWA_STORE, tryb);
      const zadanie = dzialanie(transakcja.objectStore(NAZWA_STORE));
      transakcja.oncomplete = () => resolve(zadanie.result);
      transakcja.onerror = () => reject(transakcja.error ?? new Error("Błąd zapisu w pamięci telefonu."));
      transakcja.onabort = () => reject(transakcja.error ?? new Error("Zapis w pamięci telefonu został przerwany."));
    });
  } finally {
    baza.close();
  }
}

function powiadomOZmianie() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ZDARZENIE_KOLEJKI));
  }
}

export async function dodajDoKolejki(wpis: PlikiProtokoluWKolejce) {
  await wykonaj("readwrite", (store) => store.put(wpis));
  powiadomOZmianie();
}

async function usunZKolejki(id: string) {
  await wykonaj("readwrite", (store) => store.delete(id));
  powiadomOZmianie();
}

export async function pobierzKolejke(): Promise<PlikiProtokoluWKolejce[]> {
  try {
    return await wykonaj("readonly", (store) => store.getAll() as IDBRequest<PlikiProtokoluWKolejce[]>);
  } catch {
    return [];
  }
}

export async function liczbaProtokolowWKolejce() {
  return (await pobierzKolejke()).length;
}

function pobierzStorage() {
  const app = getFirebaseApp();
  if (!app) {
    throw new Error("Firebase nie jest skonfigurowany.");
  }
  const storage = getStorage(app);
  storage.maxUploadRetryTime = MAKS_CZAS_WYSYLKI_MS;
  storage.maxOperationRetryTime = MAKS_CZAS_WYSYLKI_MS;
  return storage;
}

export async function zapiszPlikWStorage(klientId: string, protokolId: string, nazwa: string, dataUrl: string) {
  if (!dataUrl.startsWith("data:")) {
    return dataUrl;
  }

  const plik = ref(pobierzStorage(), `klienci/${klientId}/protokoly/${protokolId}/${nazwa}`);
  await uploadString(plik, dataUrl, "data_url");
  return getDownloadURL(plik);
}

/** Błąd, którego ponawianie nic nie da (np. brak uprawnień), więc nie chowamy go do kolejki. */
export function czyBladTrwaly(error: unknown) {
  return error instanceof FirebaseError && error.code === "storage/unauthorized";
}

let trwaPrzetwarzanie = false;

/**
 * Wysyła zdjęcia i załączniki zapisane w telefonie bez internetu, a potem uzupełnia nimi protokół.
 * Bezpieczne do wielokrotnego wywoływania: pliki mają stałe nazwy, więc ponowna wysyłka niczego nie dubluje.
 */
export async function przetworzKolejkePlikow(): Promise<void> {
  if (trwaPrzetwarzanie || brakSieci()) {
    return;
  }
  const db = getDb();
  if (!db) {
    return;
  }

  trwaPrzetwarzanie = true;
  try {
    for (const wpis of await pobierzKolejke()) {
      try {
        const adresyZdjec: string[] = [];
        for (let indeks = 0; indeks < wpis.zdjecia.length; indeks += 1) {
          adresyZdjec.push(
            await zapiszPlikWStorage(wpis.klientId, wpis.id, `zdjecie-${indeks + 1}`, wpis.zdjecia[indeks].src),
          );
        }
        const adresPdf = wpis.zalacznikPdf.startsWith("data:application/pdf")
          ? await zapiszPlikWStorage(wpis.klientId, wpis.id, "zalacznik.pdf", wpis.zalacznikPdf)
          : "";

        await zapiszBezCzekania(
          updateDoc(doc(db, KOLEKCJE.klienci, wpis.klientId, "protokoly", wpis.id), {
            zdjecia: adresyZdjec,
            podpisyZdjec: wpis.zdjecia.map((zdjecie) => zdjecie.podpis.trim()),
            maZalacznikPdf: Boolean(adresPdf),
            ...(adresPdf ? { zalacznikPdf: adresPdf } : {}),
            oczekujacePliki: deleteField(),
          }),
        );
        await usunZKolejki(wpis.id);
      } catch (error) {
        if (error instanceof FirebaseError && error.code === "not-found") {
          // protokół został w międzyczasie usunięty, więc pliki nie są już potrzebne
          await usunZKolejki(wpis.id).catch(() => undefined);
          continue;
        }
        console.error("Nie udało się wysłać plików protokołu, ponowię próbę:", error);
      }
    }
  } finally {
    trwaPrzetwarzanie = false;
  }
}
