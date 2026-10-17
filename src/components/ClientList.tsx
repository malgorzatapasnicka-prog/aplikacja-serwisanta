"use client";

import { useEffect, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { KOLEKCJE } from "@/lib/collections";
import { getDb } from "@/lib/firebase";

type KlientDokument = {
  id: string;
  imie?: string;
  nazwisko?: string;
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

  // Stan edycji
  const [edytowanyId, setEdytowanyId] = useState<string | null>(null);
  const [formEdycji, setFormEdycji] = useState<KlientDokument | null>(null);
  const [zapisujeEdycje, setZapisujeEdycje] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

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
        const lista: KlientDokument[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setKlienci(lista);
        setLaduje(false);
      },
      (err) => {
        console.error("Błąd pobierania klientów:", err);
        setLaduje(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const pobierzImie = (k: KlientDokument) => {
    if (k.imie) return k.imie;
    if (k.imieNazwisko) return k.imieNazwisko.split(" ")[0] || "";
    return "";
  };

  const pobierzNazwisko = (k: KlientDokument) => {
    if (k.nazwisko) return k.nazwisko;
    if (k.imieNazwisko) return k.imieNazwisko.split(" ").slice(1).join(" ") || "";
    return "";
  };

  // Eksport CSV z podziałem na Imię i Nazwisko
  const handleEksportCSV = () => {
    if (klienci.length === 0) {
      alert("Baza klientów jest pusta.");
      return;
    }

    const naglowki = [
      "ID",
      "Imię",
      "Nazwisko",
      "Telefon",
      "E-mail",
      "Adres",
      "Numer kotła",
      "Data ostatniego przeglądu",
    ];

    const wiersze = klienci.map((k) => [
      `"${(k.id || "").replace(/"/g, '""')}"`,
      `"${pobierzImie(k).replace(/"/g, '""')}"`,
      `"${pobierzNazwisko(k).replace(/"/g, '""')}"`,
      `"${(k.telefon || "").replace(/"/g, '""')}"`,
      `"${(k.email || "").replace(/"/g, '""')}"`,
      `"${(k.adres || "").replace(/"/g, '""')}"`,
      `"${(k.numerKotla || "").replace(/"/g, '""')}"`,
      `"${(k.dataOstatniegoPrzegladu || "").replace(/"/g, '""')}"`,
    ]);

    const zawartoscCSV =
      "\uFEFF" +
      [naglowki.join(";"), ...wiersze.map((w) => w.join(";"))].join("\r\n");

    const blob = new Blob([zawartoscCSV], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dzisiejszaData = new Date().toISOString().split("T")[0];

    link.setAttribute("href", url);
    link.setAttribute("download", `baza_klientow_${dzisiejszaData}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Usuwanie klienta
  const handleUsun = async (id: string, nazwa?: string) => {
    const potwierdzenie = window.confirm(
      `Czy na pewno chcesz bezpowrotnie usunąć klienta: ${nazwa || "bez nazwy"}?`
    );
    if (!potwierdzenie) return;

    const db = getDb();
    if (!db) return;

    try {
      await deleteDoc(doc(db, KOLEKCJE.klienci, id));
    } catch (err) {
      console.error("Błąd podczas usuwania:", err);
      alert("Nie udało się usunąć klienta. Sprawdź uprawnienia w Firestore.");
    }
  };

  // Start edycji
  const handleStartEdycja = (klient: KlientDokument) => {
    setEdytowanyId(klient.id);
    setFormEdycji({
      ...klient,
      imie: pobierzImie(klient),
      nazwisko: pobierzNazwisko(klient),
    });
    setBlad(null);
  };

  const handleAnulujEdycje = () => {
    setEdytowanyId(null);
    setFormEdycji(null);
    setBlad(null);
  };

  const handleZapiszEdycje = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edytowanyId || !formEdycji) return;

    const db = getDb();
    if (!db) return;

    setZapisujeEdycje(true);
    setBlad(null);

    try {
      const docRef = doc(db, KOLEKCJE.klienci, edytowanyId);
      const imieTrim = formEdycji.imie?.trim() || "";
      const nazwiskoTrim = formEdycji.nazwisko?.trim() || "";

      await updateDoc(docRef, {
        imie: imieTrim,
        nazwisko: nazwiskoTrim,
        imieNazwisko: `${imieTrim} ${nazwiskoTrim}`.trim(),
        telefon: formEdycji.telefon?.trim() || "",
        email: formEdycji.email?.trim() || "",
        adres: formEdycji.adres?.trim() || "",
        dataOstatniegoPrzegladu: formEdycji.dataOstatniegoPrzegladu || "",
        numerKotla: formEdycji.numerKotla?.trim() || "",
      });
      setEdytowanyId(null);
      setFormEdycji(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Błąd zapisu edycji.";
      setBlad(msg);
    } finally {
      setZapisujeEdycje(false);
    }
  };

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
    const q = szukaj.toLowerCase();
    const imie = pobierzImie(k).toLowerCase();
    const nazwisko = pobierzNazwisko(k).toLowerCase();
    const calosc = `${imie} ${nazwisko}`;

    return (
      calosc.includes(q) ||
      (k.telefon || "").toLowerCase().includes(q) ||
      (k.adres || "").toLowerCase().includes(q) ||
      (k.numerKotla || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <input
          type="text"
          value={szukaj}
          onChange={(e) => setSzukaj(e.target.value)}
          placeholder="Szukaj klienta (imię, nazwisko, telefon, adres, numer kotła)..."
          className="flex-1 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm text-stone-900 shadow-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
        />
        <button
          type="button"
          onClick={handleEksportCSV}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 shadow-sm transition hover:bg-stone-50 hover:text-stone-900"
          title="Pobierz bazę do arkusza kalkulacyjnego"
        >
          📥 Pobierz CSV
        </button>
      </div>

      <div className="space-y-4">
        {przefiltrowani.map((klient) => {
          const imie = pobierzImie(klient);
          const nazwisko = pobierzNazwisko(klient);
          const pelnaNazwa = `${imie} ${nazwisko}`.trim() || "Klient bez nazwy";
          const czyEdytowany = edytowanyId === klient.id;

          if (czyEdytowany && formEdycji) {
            return (
              <form
                key={klient.id}
                onSubmit={handleZapiszEdycje}
                className="rounded-xl border-2 border-amber-400 bg-amber-50/20 p-5 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                  <span className="text-sm font-bold text-stone-900">
                    Edycja danych klienta
                  </span>
                  {blad && <span className="text-xs text-red-600">{blad}</span>}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                  <div>
                    <label className="text-[11px] font-semibold uppercase text-stone-600">
                      Imię
                    </label>
                    <input
                      type="text"
                      value={formEdycji.imie || ""}
                      onChange={(e) =>
                        setFormEdycji({ ...formEdycji, imie: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 text-sm outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold uppercase text-stone-600">
                      Nazwisko
                    </label>
                    <input
                      type="text"
                      value={formEdycji.nazwisko || ""}
                      onChange={(e) =>
                        setFormEdycji({ ...formEdycji, nazwisko: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 text-sm outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold uppercase text-stone-600">
                      Telefon
                    </label>
                    <input
                      type