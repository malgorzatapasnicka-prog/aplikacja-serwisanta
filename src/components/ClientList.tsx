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
import { AddProtocolForm } from "@/components/AddProtocolForm";

type Protokol = {
  id: string;
  nazwaRaportu: string;
  czynnosci: string;
  status?: string;
  typKotla?: string;
  mocNominalna?: string;
  sterownik?: string;
  numerSeryjny?: string;
  grzanie?: string;
  maksymalnaTemperaturaZasilania?: string;
  zdjecia?: string[];
  dataWypelnienia: string;
};

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
  protokoly?: Protokol[];
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

  // Stan edycji klienta
  const [edytowanyId, setEdytowanyId] = useState<string | null>(null);
  const [formEdycji, setFormEdycji] = useState<KlientDokument | null>(null);
  const [zapisujeEdycje, setZapisujeEdycje] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  // Stan modala protokołu oraz pobierania PDF
  const [protokolKlient, setProtokolKlient] = useState<KlientDokument | null>(null);
  const [pobieramPdfId, setPobieramPdfId] = useState<string | null>(null);

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
    if (k.imie && k.imie.trim() !== "") return k.imie;
    if (k.imieNazwisko) {
      const czesci = k.imieNazwisko.trim().split(" ");
      return czesci[0] || "";
    }
    return "";
  };

  const pobierzNazwisko = (k: KlientDokument) => {
    if (k.nazwisko && k.nazwisko.trim() !== "") return k.nazwisko;
    if (k.imieNazwisko) {
      const czesci = k.imieNazwisko.trim().split(" ");
      return czesci.slice(1).join(" ") || "";
    }
    return "";
  };

  // Eksport bazy do CSV z UTF-8 BOM
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

  // Pobieranie PDF metodą POST do /api/protokol/pdf
  const handlePobierzPdf = async (
    klientId: string,
    protokolId: string,
    nazwaRaportu: string
  ) => {
    try {
      setPobieramPdfId(protokolId);

      const res = await fetch("/api/protokol/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ klientId, protokolId }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.blad || `Błąd pobierania (${res.status})`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${nazwaRaportu || "protokol"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Nie udało się pobrać PDF.";
      alert(msg);
    } finally {
      setPobieramPdfId(null);
    }
  };

  // Usuwanie całego klienta
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
      console.error("Błąd podczas usuwania klienta:", err);
      alert("Nie udało się usunąć klienta. Sprawdź uprawnienia w Firestore.");
    }
  };

  // Usuwanie konkretnego raportu/protokołu
  const handleUsunProtokol = async (
    klientId: string,
    protokolId: string,
    nazwaRaportu: string
  ) => {
    const potwierdzenie = window.confirm(
      `Czy na pewno chcesz usunąć raport "${nazwaRaportu}"?`
    );
    if (!potwierdzenie) return;

    const db = getDb();
    if (!db) return;

    try {
      const klient = klienci.find((k) => k.id === klientId);
      if (!klient || !klient.protokoly) return;

      const zaktualizowaneProtokoly = klient.protokoly.filter((p) => p.id !== protokolId);

      await updateDoc(doc(db, KOLEKCJE.klienci, klientId), {
        protokoly: zaktualizowaneProtokoly,
      });
    } catch (err) {
      console.error("Błąd usuwania protokołu:", err);
      alert("Nie udało się usunąć protokołu.");
    }
  };

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
      {/* Pasek narzędzi: Wyszukiwarka + CSV */}
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

      {/* Lista kafelków */}
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

                  <div className="sm:col-span-2">
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
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
                <h3 className="text-lg font-bold text-stone-900">
                  {pelnaNazwa}
                </h3>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setProtokolKlient(klient)}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                  >
                    📋 Raport z wizyty
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartEdycja(klient)}
                    className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300"
                  >
                    ✏️ Edytuj
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUsun(klient.id, pelnaNazwa)}
                    className="rounded-lg border border-red-100 bg-red-50/50 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 hover:text-red-700"
                  >
                    🗑️ Usuń
                  </button>
                </div>
              </div>

              {/* Rozdzielone komórki Imię i Nazwisko oraz pozostałe dane */}
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                <KomorkaDanych etykieta="Imię" wartosc={imie} ikona="👤" />
                <KomorkaDanych etykieta="Nazwisko" wartosc={nazwisko} ikona="👤" />
                <KomorkaDanych etykieta="Telefon" wartosc={klient.telefon} ikona="📞" />
                <KomorkaDanych etykieta="E-mail" wartosc={klient.email} ikona="✉️" />
                <KomorkaDanych etykieta="Adres" wartosc={klient.adres} ikona="📍" />
                <KomorkaDanych etykieta="Numer kotła" wartosc={klient.numerKotla} ikona="🔥" />
                <KomorkaDanych
                  etykieta="Data ostatniego przeglądu"
                  wartosc={klient.dataOstatniegoPrzegladu}
                  ikona="📅"
                />
              </div>

              {/* Lista wystawionych raportów z wizyty / protokołów */}
              {klient.protokoly && klient.protokoly.length > 0 && (
                <div className="mt-4 border-t border-stone-100 pt-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                    Wystawione protokoły ({klient.protokoly.length}):
                  </span>
                  <div className="mt-2 space-y-2">
                    {klient.protokoly.map((protokol) => (
                      <div
                        key={protokol.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-stone-50 border border-stone-200 px-3 py-2 text-xs"
                      >
                        <div>
                          <strong className="text-stone-900">{protokol.nazwaRaportu}</strong>
                          <span className="ml-2 text-stone-500">({protokol.dataWypelnienia})</span>
                          <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-amber-800 font-medium">
                            {protokol.czynnosci}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            disabled={pobieramPdfId === protokol.id}
                            onClick={() =>
                              handlePobierzPdf(
                                klient.id,
                                protokol.id,
                                protokol.nazwaRaportu
                              )
                            }
                            className="font-semibold text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
                          >
                            {pobieramPdfId === protokol.id
                              ? "Generowanie..."
                              : "📄 Pobierz PDF"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleUsunProtokol(
                                klient.id,
                                protokol.id,
                                protokol.nazwaRaportu
                              )
                            }
                            className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600 transition"
                            title="Usuń ten raport"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {przefiltrowani.length === 0 && (
          <div className="rounded-xl border border-dashed border-stone-200 p-6 text-center text-sm text-stone-500">
            Brak klientów pasujących do frazy &quot;{szukaj}&quot;.
          </div>
        )}
      </div>

      {/* Modal dodawania nowego protokołu z wizyty */}
      {protokolKlient && (
        <AddProtocolForm
          klientId={protokolKlient.id}
          imieNazwisko={`${pobierzImie(protokolKlient)} ${pobierzNazwisko(
            protokolKlient
          )}`.trim()}
          onClose={() => setProtokolKlient(null)}
        />
      )}
    </div>
  );
}