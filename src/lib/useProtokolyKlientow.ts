"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { KOLEKCJE } from "@/lib/collections";
import { gdySesjaAktywna, getFirebaseApp } from "@/lib/firebase";
import { protokolyZDokumentu, scalProtokoly } from "@/lib/klientDokument";
import type { Protokol } from "@/types/protokol";

type KlientProtokolow = {
  id: string;
  imie?: string;
  nazwisko?: string;
  imieNazwisko?: string;
  nazwaFirmy?: string;
  protokoly?: unknown;
};

export type WierszProtokolu = {
  klientId: string;
  klientNazwa: string;
  protokol: Protokol;
};

function nazwaKlienta(klient: KlientProtokolow) {
  const imieNazwisko = (klient.imieNazwisko ?? "").trim() || `${klient.imie ?? ""} ${klient.nazwisko ?? ""}`.trim();
  const firma = (klient.nazwaFirmy ?? "").trim();
  if (imieNazwisko && firma) {
    return `${imieNazwisko} (${firma})`;
  }
  return imieNazwisko || firma || "Klient bez nazwy";
}

/**
 * Wszystkie protokoły wszystkich klientów (stara tablica w dokumencie klienta + podkolekcja
 * `protokoly`), odświeżane na żywo.
 */
export function useProtokolyKlientow() {
  const [klienci, setKlienci] = useState<KlientProtokolow[]>([]);
  const [podkolekcje, setPodkolekcje] = useState<Record<string, Protokol[]>>({});
  const [laduje, setLaduje] = useState(() => getFirebaseApp() !== null);
  const [blad, setBlad] = useState("");

  useEffect(() => {
    if (!getFirebaseApp()) {
      return;
    }

    return gdySesjaAktywna((db) =>
      onSnapshot(
        query(collection(db, KOLEKCJE.klienci), orderBy("utworzono", "desc")),
        (snapshot) => {
          setKlienci(snapshot.docs.map((dokument) => ({ ...dokument.data(), id: dokument.id }) as KlientProtokolow));
          setLaduje(false);
        },
        (error) => {
          console.error("Błąd pobierania klientów:", error);
          setBlad("Nie udało się pobrać klientów. Sprawdź połączenie i uprawnienia w Firestore.");
          setLaduje(false);
        },
      ),
    );
  }, []);

  const kluczKlientow = [...new Set(klienci.map((klient) => klient.id).filter((id) => id.length > 0))].sort().join("\n");

  useEffect(() => {
    const ids = kluczKlientow.split("\n").filter((id) => id.length > 0);
    if (ids.length === 0) {
      return;
    }

    return gdySesjaAktywna((db) => {
      const wypisania = ids.map((klientId) =>
        onSnapshot(
          collection(db, KOLEKCJE.klienci, klientId, "protokoly"),
          (snapshot) => {
            const lista = protokolyZDokumentu(
              snapshot.docs.map((dokument) => ({ ...dokument.data(), id: dokument.id })),
            );
            setPodkolekcje((aktualne) => ({ ...aktualne, [klientId]: lista }));
          },
          (error) => {
            console.error("Błąd pobierania protokołów:", error);
            setBlad("Nie udało się pobrać części protokołów. Sprawdź uprawnienia w Firestore.");
          },
        ),
      );

      return () => {
        wypisania.forEach((wypisz) => wypisz());
      };
    });
  }, [kluczKlientow]);

  const wiersze = useMemo<WierszProtokolu[]>(
    () =>
      klienci.flatMap((klient) =>
        scalProtokoly(protokolyZDokumentu(klient.protokoly), podkolekcje[klient.id] ?? []).map((protokol) => ({
          klientId: klient.id,
          klientNazwa: nazwaKlienta(klient),
          protokol,
        })),
      ),
    [klienci, podkolekcje],
  );

  return { wiersze, laduje, blad };
}
