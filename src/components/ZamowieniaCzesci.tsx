"use client";

import { FirebaseError } from "firebase/app";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from "firebase/firestore";
import { FormEvent, useEffect, useState } from "react";
import { KOLEKCJE } from "@/lib/collections";
import { getDb, gdySesjaAktywna } from "@/lib/firebase";
import { KOMUNIKAT_ZAPISANO_OFFLINE, zapiszBezCzekania } from "@/lib/zapisOffline";

const STATUSY = ["Do zamówienia", "Zamówione", "Zrealizowane"] as const;
type StatusZamowienia = (typeof STATUSY)[number];

type KlientOpcja = {
  id: string;
  nazwa: string;
  adres: string;
  telefon: string;
};

type KlientDane = {
  imieNazwisko: string;
  adres: string;
  telefon: string;
};

type ZamowienieCzesci = {
  id: string;
  nazwaCzesci: string;
  klientId: string;
  klientDane: KlientDane;
  status: StatusZamowienia;
  dataDodania: Timestamp | null;
};

const KLASY_STATUSU: Record<StatusZamowienia, string> = {
  "Do zamówienia": "border-amber-200 bg-amber-50 text-amber-700",
  Zamówione: "border-blue-200 bg-blue-50 text-blue-700",
  Zrealizowane: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

function tekst(wartosc: unknown) {
  return typeof wartosc === "string" ? wartosc.trim() : "";
}

function opisKlienta(klient: KlientOpcja) {
  return klient.adres ? `${klient.nazwa} (${klient.adres})` : klient.nazwa;
}

function formatujDate(data: Timestamp | null) {
  if (!data) {
    return "przed chwilą";
  }
  return data.toDate().toLocaleString("pl-PL", { dateStyle: "medium", timeStyle: "short" });
}

function komunikatBledu(error: unknown) {
  if (error instanceof FirebaseError && error.code === "permission-denied") {
    return `Firestore odrzuciło zapis. W regułach dodaj dostęp zalogowanego serwisanta do kolekcji ${KOLEKCJE.zamowieniaCzesci}.`;
  }
  return error instanceof Error && error.message ? error.message : "Nie udało się zapisać zamówienia.";
}

export function ZamowieniaCzesci() {
  const [klienci, setKlienci] = useState<KlientOpcja[]>([]);
  const [zamowienia, setZamowienia] = useState<ZamowienieCzesci[]>([]);
  const [ladujeKlientow, setLadujeKlientow] = useState(true);
  const [ladujeZamowienia, setLadujeZamowienia] = useState(true);

  const [nazwaCzesci, setNazwaCzesci] = useState("");
  const [klientId, setKlientId] = useState("");
  const [zapisuje, setZapisuje] = useState(false);
  const [sukces, setSukces] = useState("");
  const [blad, setBlad] = useState("");
  const [bladListy, setBladListy] = useState("");

  // Wszyscy klienci z kolekcji klienci (bez orderBy, żeby nie pominąć starszych wpisów bez daty utworzenia)
  useEffect(() => {
    return gdySesjaAktywna((db) =>
      onSnapshot(
        collection(db, KOLEKCJE.klienci),
        (snap) => {
          const lista = snap.docs
            .map((dokument) => {
              const dane = dokument.data();
              const imieNazwisko =
                tekst(dane.imieNazwisko) || `${tekst(dane.imie)} ${tekst(dane.nazwisko)}`.trim() || "Bez nazwy";
              const firma = tekst(dane.nazwaFirmy);
              return {
                id: dokument.id,
                nazwa: firma ? `${firma} – ${imieNazwisko}` : imieNazwisko,
                adres: tekst(dane.adres),
                telefon: tekst(dane.telefon),
              };
            })
            .sort((a, b) => a.nazwa.localeCompare(b.nazwa, "pl"));
          setKlienci(lista);
          setLadujeKlientow(false);
        },
        () => setLadujeKlientow(false),
      ),
    );
  }, []);

  useEffect(() => {
    return gdySesjaAktywna((db) =>
      onSnapshot(
        query(collection(db, KOLEKCJE.zamowieniaCzesci), orderBy("dataDodania", "desc")),
        (snap) => {
          setZamowienia(
            snap.docs.map((dokument) => {
              // "estimate": zamówienie dodane przed chwilą ma od razu datę, nawet zanim potwierdzi ją serwer
              const dane = dokument.data({ serverTimestamps: "estimate" });
              const daneKlienta = (dane.klientDane ?? {}) as Partial<KlientDane>;
              return {
                id: dokument.id,
                nazwaCzesci: tekst(dane.nazwaCzesci),
                klientId: tekst(dane.klientId),
                klientDane: {
                  imieNazwisko: tekst(daneKlienta.imieNazwisko),
                  adres: tekst(daneKlienta.adres),
                  telefon: tekst(daneKlienta.telefon),
                },
                status: STATUSY.includes(dane.status) ? dane.status : "Do zamówienia",
                dataDodania: (dane.dataDodania as Timestamp | undefined) ?? null,
              };
            }),
          );
          setBladListy("");
          setLadujeZamowienia(false);
        },
        (error) => {
          setBladListy(komunikatBledu(error));
          setLadujeZamowienia(false);
        },
      ),
    );
  }, []);

  async function dodajZamowienie(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSukces("");
    setBlad("");

    const nazwa = nazwaCzesci.trim();
    const klient = klienci.find((pozycja) => pozycja.id === klientId);
    if (!nazwa) {
      setBlad("Wpisz nazwę zamawianej części.");
      return;
    }
    if (!klient) {
      setBlad("Wybierz klienta, dla którego jest ta część.");
      return;
    }

    const db = getDb();
    if (!db) {
      setBlad("Brak sesji serwisanta. Zaloguj się ponownie.");
      return;
    }

    setZapisuje(true);
    try {
      const zapisano = await zapiszBezCzekania(
        setDoc(doc(collection(db, KOLEKCJE.zamowieniaCzesci)), {
          nazwaCzesci: nazwa,
          klientId: klient.id,
          klientDane: {
            imieNazwisko: klient.nazwa,
            adres: klient.adres,
            telefon: klient.telefon,
          },
          status: "Do zamówienia",
          dataDodania: serverTimestamp(),
        }),
      );
      setNazwaCzesci("");
      setSukces(zapisano ? "Dodano do zamówień." : `Dodano do zamówień. ${KOMUNIKAT_ZAPISANO_OFFLINE}`);
    } catch (error) {
      setBlad(komunikatBledu(error));
    } finally {
      setZapisuje(false);
    }
  }

  async function zmienStatus(id: string, status: StatusZamowienia) {
    const db = getDb();
    if (!db) {
      return;
    }
    try {
      await zapiszBezCzekania(updateDoc(doc(db, KOLEKCJE.zamowieniaCzesci, id), { status }));
    } catch (error) {
      alert(komunikatBledu(error));
    }
  }

  return (
    <>
      <form onSubmit={dodajZamowienie} className="card">
        <h2 className="text-base font-semibold text-slate-900">Nowe zamówienie części</h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-semibold uppercase text-slate-600">
            Nazwa zamawianej części
            <input
              type="text"
              value={nazwaCzesci}
              onChange={(e) => setNazwaCzesci(e.target.value)}
              placeholder="np. pompa obiegowa Grundfos UPM3"
              className="field mt-1.5 font-normal normal-case text-slate-900"
            />
          </label>

          <label className="block text-xs font-semibold uppercase text-slate-600">
            Klient
            <select
              value={klientId}
              onChange={(e) => setKlientId(e.target.value)}
              disabled={ladujeKlientow}
              className="field mt-1.5 font-normal normal-case text-slate-900"
            >
              <option value="">
                {ladujeKlientow
                  ? "Ładowanie klientów..."
                  : klienci.length === 0
                    ? "Brak klientów w bazie"
                    : "Wybierz klienta..."}
              </option>
              {klienci.map((klient) => (
                <option key={klient.id} value={klient.id}>
                  {opisKlienta(klient)}
                </option>
              ))}
            </select>
          </label>
        </div>

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

        <div className="mt-6">
          <button type="submit" disabled={zapisuje} className="btn btn-primary">
            {zapisuje ? "Dodawanie…" : "Dodaj do zamówień"}
          </button>
        </div>
      </form>

      <section className="card">
        <h2 className="text-base font-semibold text-slate-900">Lista zamówień ({zamowienia.length})</h2>

        {bladListy ? (
          <p role="alert" className="mt-4 text-sm font-medium text-red-700">
            {bladListy}
          </p>
        ) : ladujeZamowienia ? (
          <p className="mt-4 text-center text-sm text-slate-500">Ładowanie zamówień...</p>
        ) : zamowienia.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            Brak zamówień. Dodaj pierwszą część powyżej.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {zamowienia.map((zamowienie) => (
              <li
                key={zamowienie.id}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{zamowienie.nazwaCzesci}</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {zamowienie.klientDane.imieNazwisko || "Nieznany klient"}
                    {zamowienie.klientDane.adres ? (
                      <span className="text-slate-500"> · {zamowienie.klientDane.adres}</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Dodano: {formatujDate(zamowienie.dataDodania)}</p>
                </div>

                <select
                  value={zamowienie.status}
                  onChange={(e) => zmienStatus(zamowienie.id, e.target.value as StatusZamowienia)}
                  aria-label={`Status zamówienia: ${zamowienie.nazwaCzesci}`}
                  className={`shrink-0 cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold ${KLASY_STATUSU[zamowienie.status]}`}
                >
                  {STATUSY.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
