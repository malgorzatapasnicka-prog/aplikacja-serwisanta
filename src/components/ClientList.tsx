"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { KOLEKCJE } from "@/lib/collections";
import { getDb } from "@/lib/firebase";

type KlientDokument = {
  id: string;
  imieNazwisko?: string;
  telefon?: string;
  email?: string;
  adres?: string;
  dataOstatniegoPrzegladu?: string;
  numerKotla?: string;
};

function KomorkaDanych({
  etykieta,
  wartosc,
  ikona,
}: {
  etykieta: string;
  wartosc?: string;
  ikona?: string;
}) {
  if (!wartosc || wartosc.trim() === "") return null;

  return (
    <div className="flex flex-col rounded-lg border border-stone-200 bg-stone-50/70 p-3">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
        {ikona ? `${ikona} ` : ""}{etykieta}
      </span>
      <span className="mt-1 text-sm font-medium text-stone-900 break-words">
        {wartosc}
      </span>
    </div>
  );
}

export function ClientList({ opisPustej }: { opisPustej?: string }) {
  const [klienci, setKlienci] = useState<KlientDokument[]>([]);
  const [laduje, setLaduje] = useState(true);
  const [szukaj, setSzukaj] = useState("");

  useEffect(() => {
    const db = getDb();
    if (!db) {
      setLaduje(false);
      return;
    }

    const q = query(
      collection(db, KOLEKCJE.klienci),
      orderBy("utworzono", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const lista: KlientDokument[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setKlienci(lista);
        setLaduje(false);
      },
      () => {
        setLaduje(false);
      }
    );

    return () => unsubscribe();
  }, []);

  if (laduje) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
        Ładowanie listy klientów...
      </div>
    );
  }

  if (klienci.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
        {opisPustej || "Brak zapisanych klientów w bazie."}
      </div>
    );
  }

  const przefiltrowani = klienci.filter((k) => {
    const queryStr = szukaj.toLowerCase();
    const nazwisko = (k.imieNazwisko || "").toLowerCase();
    const tel = (k.telefon || "").toLowerCase();
    const adr = (k.adres || "").toLowerCase();
    const kociol = (k.numerKotla || "").toLowerCase();

    return (
      nazwisko.includes(queryStr) ||
      tel.includes(queryStr) ||
      adr.includes(queryStr) ||
      kociol.includes(queryStr)
    );
  });

  return (
    <div className="space-y-4">
      {/* Wyszukiwarka */}
      <div>
        <input
          type="text"
          value={szukaj}
          onChange={(e) => setSzukaj(e.target.value)}
          placeholder="Szukaj klienta (imię, nazwisko, telefon, adres, numer kotła)..."
          className="w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
        />
      </div>

      {/* Lista kafelków */}
      <div className="space-y-4">
        {przefiltrowani.map((klient) => (
          <div
            key={klient.id}
            className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            {/* Nagłówek klienta */}
            <div className="border-b border-stone-100 pb-3">
              <h3 className="text-lg font-bold text-stone-900">
                {klient.imieNazwisko || "Klient bez nazwy"}
              </h3>
            </div>

            {/* Podpisane komórki danych */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              <KomorkaDanych
                etykieta="Telefon"
                wartosc={klient.telefon}
                ikona="📞"
              />
              <KomorkaDanych
                etykieta="E-mail"
                wartosc={klient.email}
                ikona="✉️"
              />
              <KomorkaDanych
                etykieta="Adres"
                wartosc={klient.adres}
                ikona="📍"
              />
              <KomorkaDanych
                etykieta="Numer kotła"
                wartosc={klient.numerKotla}
                ikona="🔥"
              />
              <KomorkaDanych
                etykieta="Data ostatniego przeglądu"
                wartosc={klient.dataOstatniegoPrzegladu}
                ikona="📅"
              />
            </div>
          </div>
        ))}

        {przefiltrowani.length === 0 && (
          <div className="rounded-xl border border-dashed border-stone-200 p-6 text-center text-sm text-stone-500">
            Brak klientów pasujących do frazy &quot;{szukaj}&quot;.
          </div>
        )}
      </div>
    </div>
  );
}