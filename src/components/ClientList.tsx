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

  // Usuwanie klienta
  const handleUsun = async (id: string, nazwisko?: string) => {
    const potwierdzenie = window.confirm(
      `Czy na pewno chcesz bezpowrotnie usunąć klienta: ${nazwisko || "bez nazwy"}?`
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

  // Rozpoczęcie edycji
  const handleStartEdycja = (klient: KlientDokument) => {
    setEdytowanyId(klient.id);
    setFormEdycji({ ...klient });
    setBlad(null);
  };

  // Anulowanie edycji
  const handleAnulujEdycje = () => {
    setEdytowanyId(null);
    setFormEdycji(null);
    setBlad(null);
  };

  // Zapisanie edycji w Firestore
  const handleZapiszEdycje = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edytowanyId || !formEdycji) return;

    const db = getDb();
    if (!db) return;

    setZapisujeEdycje(true);
    setBlad(null);

    try {
      const docRef = doc(db, KOLEKCJE.klienci, edytowanyId);
      await updateDoc(docRef, {
        imieNazwisko: formEdycji.imieNazwisko?.trim() || "",
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
    return (
      (k.imieNazwisko || "").toLowerCase().includes(q) ||
      (k.telefon || "").toLowerCase().includes(q) ||
      (k.adres || "").toLowerCase().includes(q) ||
      (k.numerKotla || "").toLowerCase().includes(q)
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
        {przefiltrowani.map((klient) => {
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

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                  <div>
                    <label className="text-[11px] font-semibold uppercase text-stone-600">
                      Imię i nazwisko
                    </label>
                    <input
                      type="text"
                      value={formEdycji.imieNazwisko || ""}
                      onChange={(e) =>
                        setFormEdycji({ ...formEdycji, imieNazwisko: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 text-sm outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold uppercase text-stone-600">
                      Telefon
                    </label>
                    <input
                      type="tel"
                      value={formEdycji.telefon || ""}
                      onChange={(e) =>
                        setFormEdycji({ ...formEdycji, telefon: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 text-sm outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold uppercase text-stone-600">
                      E-mail
                    </label>
                    <input
                      type="email"
                      value={formEdycji.email || ""}
                      onChange={(e) =>
                        setFormEdycji({ ...formEdycji, email: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 text-sm outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold uppercase text-stone-600">
                      Adres
                    </label>
                    <input
                      type="text"
                      value={formEdycji.adres || ""}
                      onChange={(e) =>
                        setFormEdycji({ ...formEdycji, adres: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 text-sm outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold uppercase text-stone-600">
                      Numer kotła
                    </label>
                    <input
                      type="text"
                      value={formEdycji.numerKotla || ""}
                      onChange={(e) =>
                        setFormEdycji({ ...formEdycji, numerKotla: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 text-sm outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold uppercase text-stone-600">
                      Data ostatniego przeglądu
                    </label>
                    <input
                      type="date"
                      value={formEdycji.dataOstatniegoPrzegladu || ""}
                      onChange={(e) =>
                        setFormEdycji({
                          ...formEdycji,
                          dataOstatniegoPrzegladu: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-stone-300 bg-white p-2 text-sm outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleAnulujEdycje}
                    className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={zapisujeEdycje}
                    className="rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-semibold text-stone-950 hover:bg-amber-400 disabled:opacity-50"
                  >
                    {zapisujeEdycje ? "Zapisywanie..." : "Zapisz zmiany"}
                  </button>
                </div>
              </form>
            );
          }

          return (
            <div
              key={klient.id}
              className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              {/* Pasek tytułowy klienta z przyciskami Edytuj / Usuń */}
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <h3 className="text-lg font-bold text-stone-900">
                  {klient.imieNazwisko || "Klient bez nazwy"}
                </h3>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleStartEdycja(klient)}
                    className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300"
                  >
                    ✏️ Edytuj
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUsun(klient.id, klient.imieNazwisko)}
                    className="rounded-lg border border-red-100 bg-red-50/50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 hover:text-red-700"
                  >
                    🗑️ Usuń
                  </button>
                </div>
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
          );
        })}

        {przefiltrowani.length === 0 && (
          <div className="rounded-xl border border-dashed border-stone-200 p-6 text-center text-sm text-stone-500">
            Brak wyników dla wyszukiwania &quot;{szukaj}&quot;.
          </div>
        )}
      </div>
    </div>
  );
}