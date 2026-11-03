"use client";

import { FirebaseError } from "firebase/app";
import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { KOLEKCJE } from "@/lib/collections";
import { getDb, gdySesjaAktywna } from "@/lib/firebase";
import { formatujIlosc, sumaWGroszach, wartoscWGroszach, type CzescMagazynowa } from "@/lib/magazyn";
import { utworzPdfRemanentu } from "@/lib/remanentPdf";
import { formatujKwote } from "@/lib/rozliczenie";
import { KOMUNIKAT_ZAPISANO_OFFLINE, zapiszBezCzekania } from "@/lib/zapisOffline";

const DOMYSLNA_JEDNOSTKA = "szt.";
const JEDNOSTKI = ["szt.", "kpl.", "m", "kg", "l", "op."];

type FormularzCzesci = {
  nazwa: string;
  kodKatalogowy: string;
  producent: string;
  kategoria: string;
  ilosc: string;
  jednostka: string;
  cenaZakupuNetto: string;
};

const PUSTY_FORMULARZ: FormularzCzesci = {
  nazwa: "",
  kodKatalogowy: "",
  producent: "",
  kategoria: "",
  ilosc: "",
  jednostka: DOMYSLNA_JEDNOSTKA,
  cenaZakupuNetto: "",
};

function tekst(wartosc: unknown) {
  return typeof wartosc === "string" ? wartosc.trim() : "";
}

function liczba(wartosc: unknown) {
  return typeof wartosc === "number" && Number.isFinite(wartosc) ? wartosc : 0;
}

/** "12,5" i "12.5" dają 12.5, a puste lub błędne pole daje undefined. */
function wczytajLiczbe(wartosc: string) {
  const czysta = wartosc.trim().replace(/\s/g, "").replace(",", ".");
  if (!czysta) {
    return undefined;
  }
  const wynik = Number(czysta);
  return Number.isFinite(wynik) ? wynik : undefined;
}

function komunikatBledu(error: unknown) {
  if (error instanceof FirebaseError && error.code === "permission-denied") {
    return `Firestore odrzuciło zapis. W regułach dodaj dostęp zalogowanego serwisanta do kolekcji ${KOLEKCJE.magazynCzesci}.`;
  }
  return error instanceof Error && error.message ? error.message : "Nie udało się zapisać części.";
}

function formatujDateWydruku() {
  return new Date().toLocaleString("pl-PL", { dateStyle: "long", timeStyle: "short" });
}

export function Magazyn() {
  const [czesci, setCzesci] = useState<CzescMagazynowa[]>([]);
  const [laduje, setLaduje] = useState(true);
  const [bladListy, setBladListy] = useState("");

  const [formularz, setFormularz] = useState<FormularzCzesci>(PUSTY_FORMULARZ);
  const [edytowanaId, setEdytowanaId] = useState<string | null>(null);
  const [zapisuje, setZapisuje] = useState(false);
  const [sukces, setSukces] = useState("");
  const [blad, setBlad] = useState("");
  const [dataWydruku, setDataWydruku] = useState("");
  const [pobieramPdf, setPobieramPdf] = useState(false);
  const [bladWydruku, setBladWydruku] = useState("");

  useEffect(() => {
    return gdySesjaAktywna((db) =>
      onSnapshot(
        collection(db, KOLEKCJE.magazynCzesci),
        (snap) => {
          setCzesci(
            snap.docs
              .map((dokument) => {
                const dane = dokument.data();
                return {
                  id: dokument.id,
                  nazwa: tekst(dane.nazwa) || "Bez nazwy",
                  kodKatalogowy: tekst(dane.kodKatalogowy),
                  producent: tekst(dane.producent),
                  kategoria: tekst(dane.kategoria),
                  ilosc: liczba(dane.ilosc),
                  jednostka: tekst(dane.jednostka) || DOMYSLNA_JEDNOSTKA,
                  cenaZakupuNetto: liczba(dane.cenaZakupuNetto),
                };
              })
              .sort((a, b) => a.nazwa.localeCompare(b.nazwa, "pl")),
          );
          setBladListy("");
          setLaduje(false);
        },
        (error) => {
          setBladListy(komunikatBledu(error));
          setLaduje(false);
        },
      ),
    );
  }, []);

  // Data remanentu ustawiana tuż przed drukiem (także po Ctrl+P), żeby była aktualna w momencie wydruku
  useEffect(() => {
    const przygotujWydruk = () => flushSync(() => setDataWydruku(formatujDateWydruku()));
    window.addEventListener("beforeprint", przygotujWydruk);
    return () => window.removeEventListener("beforeprint", przygotujWydruk);
  }, []);

  const sumaGrosze = useMemo(() => sumaWGroszach(czesci), [czesci]);
  const kategorie = useMemo(() => [...new Set(czesci.map((c) => c.kategoria).filter(Boolean))].sort(), [czesci]);
  const producenci = useMemo(() => [...new Set(czesci.map((c) => c.producent).filter(Boolean))].sort(), [czesci]);

  function zmienPole<K extends keyof FormularzCzesci>(pole: K, wartosc: FormularzCzesci[K]) {
    setFormularz((aktualny) => ({ ...aktualny, [pole]: wartosc }));
  }

  function rozpocznijEdycje(czesc: CzescMagazynowa) {
    setEdytowanaId(czesc.id);
    setFormularz({
      nazwa: czesc.nazwa,
      kodKatalogowy: czesc.kodKatalogowy,
      producent: czesc.producent,
      kategoria: czesc.kategoria,
      ilosc: String(czesc.ilosc).replace(".", ","),
      jednostka: czesc.jednostka,
      cenaZakupuNetto: String(czesc.cenaZakupuNetto).replace(".", ","),
    });
    setSukces("");
    setBlad("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function anulujEdycje() {
    setEdytowanaId(null);
    setFormularz(PUSTY_FORMULARZ);
    setBlad("");
  }

  async function zapiszCzesc(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSukces("");
    setBlad("");

    const nazwa = formularz.nazwa.trim();
    const ilosc = wczytajLiczbe(formularz.ilosc);
    const cena = wczytajLiczbe(formularz.cenaZakupuNetto);

    if (!nazwa) {
      setBlad("Wpisz nazwę części.");
      return;
    }
    if (ilosc === undefined || ilosc < 0) {
      setBlad("Podaj ilość jako liczbę (0 lub więcej).");
      return;
    }
    if (cena === undefined || cena < 0) {
      setBlad("Podaj cenę zakupu netto jako liczbę (0 lub więcej).");
      return;
    }

    const db = getDb();
    if (!db) {
      setBlad("Brak sesji serwisanta. Zaloguj się ponownie.");
      return;
    }

    const dane = {
      nazwa,
      kodKatalogowy: formularz.kodKatalogowy.trim(),
      producent: formularz.producent.trim(),
      kategoria: formularz.kategoria.trim(),
      ilosc,
      jednostka: formularz.jednostka.trim() || DOMYSLNA_JEDNOSTKA,
      cenaZakupuNetto: Math.round(cena * 100) / 100,
    };

    setZapisuje(true);
    try {
      const zapisano = await zapiszBezCzekania(
        edytowanaId
          ? updateDoc(doc(db, KOLEKCJE.magazynCzesci, edytowanaId), dane)
          : setDoc(doc(collection(db, KOLEKCJE.magazynCzesci)), dane),
      );
      const komunikat = edytowanaId ? "Zapisano zmiany." : "Dodano część do magazynu.";
      setSukces(zapisano ? komunikat : `${komunikat} ${KOMUNIKAT_ZAPISANO_OFFLINE}`);
      setEdytowanaId(null);
      setFormularz(PUSTY_FORMULARZ);
    } catch (error) {
      setBlad(komunikatBledu(error));
    } finally {
      setZapisuje(false);
    }
  }

  async function usunCzesc(czesc: CzescMagazynowa) {
    if (!window.confirm(`Czy na pewno usunąć z magazynu: ${czesc.nazwa}?`)) {
      return;
    }
    const db = getDb();
    if (!db) {
      return;
    }
    try {
      await zapiszBezCzekania(deleteDoc(doc(db, KOLEKCJE.magazynCzesci, czesc.id)));
      if (edytowanaId === czesc.id) {
        anulujEdycje();
      }
    } catch (error) {
      alert(komunikatBledu(error));
    }
  }

  function drukujRemanent() {
    setBladWydruku("");
    flushSync(() => setDataWydruku(formatujDateWydruku()));
    try {
      window.print();
    } catch {
      setBladWydruku("Ta przeglądarka nie otwiera okna drukowania. Użyj przycisku „Pobierz PDF” i wydrukuj plik.");
    }
  }

  /** PDF remanentu: działa też tam, gdzie okno drukowania nie jest dostępne (np. aplikacja z ekranu głównego iPhone'a). */
  async function pobierzPdfRemanentu() {
    setBladWydruku("");
    setPobieramPdf(true);
    try {
      const odpowiedz = await fetch("/fonts/NotoSans-Regular.ttf");
      if (!odpowiedz.ok) {
        throw new Error("Nie udało się wczytać czcionki do PDF.");
      }
      const czcionka = await new Promise<string>((resolve, reject) => {
        const czytnik = new FileReader();
        czytnik.onload = () => resolve(String(czytnik.result).split(",")[1] ?? "");
        czytnik.onerror = () => reject(czytnik.error);
        void odpowiedz.blob().then((blob) => czytnik.readAsDataURL(blob), reject);
      });

      const teraz = new Date();
      const blob = await utworzPdfRemanentu(czesci, formatujDateWydruku(), czcionka);
      const nazwaPliku = `remanent-${teraz.toISOString().slice(0, 10)}.pdf`;
      const plik = new File([blob], nazwaPliku, { type: "application/pdf" });

      // Na telefonie otwieramy systemowe udostępnianie (zapis, AirPrint, drukarka), na komputerze pobieramy plik
      if (window.matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [plik] })) {
        try {
          await navigator.share({ files: [plik], title: "Remanent magazynu" });
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
        }
      }
      const adres = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = adres;
      link.download = nazwaPliku;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(adres), 10_000);
    } catch (error) {
      setBladWydruku(error instanceof Error && error.message ? error.message : "Nie udało się utworzyć PDF.");
    } finally {
      setPobieramPdf(false);
    }
  }

  return (
    <>
      <form onSubmit={zapiszCzesc} className="card no-print">
        <h2 className="text-base font-semibold text-slate-900">
          {edytowanaId ? "Edycja części" : "Nowa część w magazynie"}
        </h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Pole etykieta="Nazwa" className="sm:col-span-2 lg:col-span-1">
            <input
              type="text"
              value={formularz.nazwa}
              onChange={(e) => zmienPole("nazwa", e.target.value)}
              placeholder="np. Pompa obiegowa"
              className="field mt-1.5 font-normal normal-case text-slate-900"
            />
          </Pole>
          <Pole etykieta="Kod katalogowy">
            <input
              type="text"
              value={formularz.kodKatalogowy}
              onChange={(e) => zmienPole("kodKatalogowy", e.target.value)}
              className="field mt-1.5 font-normal normal-case text-slate-900"
            />
          </Pole>
          <Pole etykieta="Producent">
            <input
              type="text"
              list="magazyn-producenci"
              value={formularz.producent}
              onChange={(e) => zmienPole("producent", e.target.value)}
              className="field mt-1.5 font-normal normal-case text-slate-900"
            />
          </Pole>
          <Pole etykieta="Kategoria">
            <input
              type="text"
              list="magazyn-kategorie"
              value={formularz.kategoria}
              onChange={(e) => zmienPole("kategoria", e.target.value)}
              placeholder="np. Pompy, Armatura"
              className="field mt-1.5 font-normal normal-case text-slate-900"
            />
          </Pole>
          <Pole etykieta="Ilość">
            <input
              type="text"
              inputMode="decimal"
              value={formularz.ilosc}
              onChange={(e) => zmienPole("ilosc", e.target.value)}
              placeholder="0"
              className="field mt-1.5 font-normal normal-case text-slate-900"
            />
          </Pole>
          <Pole etykieta="Jednostka">
            <input
              type="text"
              list="magazyn-jednostki"
              value={formularz.jednostka}
              onChange={(e) => zmienPole("jednostka", e.target.value)}
              className="field mt-1.5 font-normal normal-case text-slate-900"
            />
          </Pole>
          <Pole etykieta="Cena zakupu netto (zł)">
            <input
              type="text"
              inputMode="decimal"
              value={formularz.cenaZakupuNetto}
              onChange={(e) => zmienPole("cenaZakupuNetto", e.target.value)}
              placeholder="0,00"
              className="field mt-1.5 font-normal normal-case text-slate-900"
            />
          </Pole>
        </div>

        <datalist id="magazyn-producenci">
          {producenci.map((producent) => (
            <option key={producent} value={producent} />
          ))}
        </datalist>
        <datalist id="magazyn-kategorie">
          {kategorie.map((kategoria) => (
            <option key={kategoria} value={kategoria} />
          ))}
        </datalist>
        <datalist id="magazyn-jednostki">
          {JEDNOSTKI.map((jednostka) => (
            <option key={jednostka} value={jednostka} />
          ))}
        </datalist>

        {blad ? (
          <p role="alert" className="mt-4 text-sm font-medium text-red-700">
            {blad}
          </p>
        ) : null}
        {sukces ? (
          <p role="status" className="mt-4 text-sm font-medium text-emerald-700">
            {sukces}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="submit" disabled={zapisuje} className="btn btn-primary">
            {zapisuje ? "Zapisywanie…" : edytowanaId ? "Zapisz zmiany" : "Dodaj do magazynu"}
          </button>
          {edytowanaId ? (
            <button type="button" onClick={anulujEdycje} className="btn btn-outline">
              Anuluj edycję
            </button>
          ) : null}
        </div>
      </form>

      <section className="card">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Części w magazynie ({czesci.length})</h2>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={pobierzPdfRemanentu} disabled={pobieramPdf} className="btn btn-outline">
              {pobieramPdf ? "Tworzenie PDF…" : "Pobierz PDF"}
            </button>
            <button type="button" onClick={drukujRemanent} className="btn btn-primary">
              Drukuj Remanent
            </button>
          </div>
        </div>
        {bladWydruku ? (
          <p role="alert" className="no-print mt-3 text-sm font-medium text-red-700">
            {bladWydruku}
          </p>
        ) : null}

        {/* Nagłówek widoczny tylko na wydruku */}
        <div className="hidden print:mb-4 print:block">
          <h2 className="text-xl font-bold">Remanent magazynu</h2>
          <p className="mt-1 text-sm">Data wygenerowania: {dataWydruku}</p>
        </div>

        {bladListy ? (
          <p role="alert" className="mt-4 text-sm font-medium text-red-700">
            {bladListy}
          </p>
        ) : laduje ? (
          <p className="no-print mt-4 text-center text-sm text-slate-500">Ładowanie magazynu...</p>
        ) : czesci.length === 0 ? (
          <p className="no-print mt-4 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            Magazyn jest pusty. Dodaj pierwszą część powyżej.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto print:mt-0 print:overflow-visible">
            <table className="tabela-wydruk w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500 print:text-black">
                  <th className="py-2 pr-3">Nazwa</th>
                  <th className="px-3 py-2">Kod</th>
                  <th className="px-3 py-2">Producent</th>
                  <th className="px-3 py-2 text-right">Ilość</th>
                  <th className="px-3 py-2 text-right">Cena netto</th>
                  <th className="px-3 py-2 text-right">Wartość razem</th>
                  <th className="no-print py-2 pl-3 text-right">
                    <span className="sr-only">Akcje</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {czesci.map((czesc) => (
                  <tr key={czesc.id} className={edytowanaId === czesc.id ? "bg-slate-50" : undefined}>
                    <td className="py-3 pr-3">
                      <span className="font-medium text-slate-900">{czesc.nazwa}</span>
                      {czesc.kategoria ? (
                        <span className="block text-xs text-slate-500 print:text-black">{czesc.kategoria}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-slate-700 print:text-black">{czesc.kodKatalogowy || "—"}</td>
                    <td className="px-3 py-3 text-slate-700 print:text-black">{czesc.producent || "—"}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap text-slate-900 print:text-black">
                      {formatujIlosc(czesc.ilosc)} {czesc.jednostka}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap text-slate-700 print:text-black">
                      {formatujKwote(czesc.cenaZakupuNetto)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold whitespace-nowrap text-slate-900 print:text-black">
                      {formatujKwote(wartoscWGroszach(czesc) / 100)}
                    </td>
                    <td className="no-print py-3 pl-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => rozpocznijEdycje(czesc)}
                        className="btn btn-outline btn-sm"
                      >
                        Edytuj
                      </button>{" "}
                      <button
                        type="button"
                        onClick={() => usunCzesc(czesc)}
                        aria-label={`Usuń: ${czesc.nazwa}`}
                        className="btn btn-outline btn-sm text-red-700"
                      >
                        Usuń
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300">
                  <td colSpan={5} className="py-3 pr-3 text-right text-sm font-semibold text-slate-900 print:text-black">
                    Łączna wartość magazynu (netto):
                  </td>
                  <td className="px-3 py-3 text-right text-base font-bold whitespace-nowrap text-slate-900 print:text-black">
                    {formatujKwote(sumaGrosze / 100)}
                  </td>
                  <td className="no-print" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Pole({
  etykieta,
  className = "",
  children,
}: {
  etykieta: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block text-xs font-semibold uppercase text-slate-600 ${className}`}>
      {etykieta}
      {children}
    </label>
  );
}
