"use client";

import { FirebaseError } from "firebase/app";
import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { FormEvent, useState } from "react";
import { KOLEKCJE } from "@/lib/collections";
import { getDb } from "@/lib/firebase";
import { KOMUNIKAT_ZAPISANO_OFFLINE, zapiszBezCzekania } from "@/lib/zapisOffline";

const MAKS_KOTLOW = 5;

type RodzajKlienta = "prywatna" | "firma";

type FormularzKlienta = {
  rodzaj: RodzajKlienta;
  nazwaFirmy: string;
  nip: string;
  imie: string;
  nazwisko: string;
  telefon: string;
  email: string;
  adres: string;
  dataOstatniegoPrzegladu: string;
  numeryKotlow: string[];
};

type PoleTekstowe = Exclude<keyof FormularzKlienta, "numeryKotlow" | "rodzaj">;

const PUSTY_FORMULARZ: FormularzKlienta = {
  rodzaj: "prywatna",
  nazwaFirmy: "",
  nip: "",
  imie: "",
  nazwisko: "",
  telefon: "",
  email: "",
  adres: "",
  dataOstatniegoPrzegladu: "",
  numeryKotlow: [""],
};

const POLA: {
  name: PoleTekstowe;
  label: string;
  type: string;
  autoComplete?: string;
}[] = [
  { name: "imie", label: "Imię", type: "text", autoComplete: "given-name" },
  { name: "nazwisko", label: "Nazwisko", type: "text", autoComplete: "family-name" },
  { name: "telefon", label: "Telefon", type: "tel", autoComplete: "tel" },
  { name: "email", label: "E-mail", type: "email", autoComplete: "email" },
  { name: "adres", label: "Adres", type: "text", autoComplete: "street-address" },
  { name: "dataOstatniegoPrzegladu", label: "Data ostatniego przeglądu", type: "date" },
];

const klasaPola =
  "field mt-1.5";

function komunikatBledu(error: unknown): string {
  if (error instanceof FirebaseError && error.code === "permission-denied") {
    return "Firestore odrzuciło zapis. W regułach kolekcji klienci zezwól na dodawanie dokumentów.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Nie udało się zapisać klienta.";
}

export function AddClientForm() {
  const [formularz, setFormularz] = useState<FormularzKlienta>(PUSTY_FORMULARZ);
  const [zapisuje, setZapisuje] = useState(false);
  const [sukces, setSukces] = useState("");
  const [blad, setBlad] = useState("");

  function zmienPole(name: PoleTekstowe, value: string) {
    setFormularz((aktualny) => ({ ...aktualny, [name]: value }));
    setSukces("");
  }

  function zmienRodzaj(rodzaj: RodzajKlienta) {
    setFormularz((aktualny) => ({
      ...aktualny,
      rodzaj,
      nazwaFirmy: rodzaj === "firma" ? aktualny.nazwaFirmy : "",
      nip: rodzaj === "firma" ? aktualny.nip : "",
    }));
    setSukces("");
  }

  function zmienKociol(indeks: number, value: string) {
    setFormularz((aktualny) => {
      const numeryKotlow = [...aktualny.numeryKotlow];
      numeryKotlow[indeks] = value;
      return { ...aktualny, numeryKotlow };
    });
    setSukces("");
  }

  function dodajKociol() {
    setFormularz((aktualny) => {
      if (aktualny.numeryKotlow.length >= MAKS_KOTLOW) {
        return aktualny;
      }
      return { ...aktualny, numeryKotlow: [...aktualny.numeryKotlow, ""] };
    });
    setSukces("");
  }

  function usunKociol(indeks: number) {
    setFormularz((aktualny) => ({
      ...aktualny,
      numeryKotlow: aktualny.numeryKotlow.filter((_, pozycja) => pozycja !== indeks),
    }));
    setSukces("");
  }

  async function zapiszKlienta(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSukces("");
    setBlad("");

    const db = getDb();
    if (!db) {
      setBlad("Firebase nie jest skonfigurowany. Uzupełnij src/lib/firebaseConfig.ts.");
      return;
    }

    setZapisuje(true);

    try {
      const imieTrim = formularz.imie.trim();
      const nazwiskoTrim = formularz.nazwisko.trim();
      const firma = formularz.rodzaj === "firma";
      const numeryKotlow = formularz.numeryKotlow.map((numer) => numer.trim()).slice(0, MAKS_KOTLOW);
      while (numeryKotlow.length > 0 && numeryKotlow[numeryKotlow.length - 1] === "") {
        numeryKotlow.pop();
      }

      const zapisano = await zapiszBezCzekania(
        setDoc(doc(collection(db, KOLEKCJE.klienci)), {
        rodzajKlienta: formularz.rodzaj,
        nazwaFirmy: firma ? formularz.nazwaFirmy.trim() : "",
        nip: firma ? formularz.nip.replace(/\s/g, "") : "",
        imie: imieTrim,
        nazwisko: nazwiskoTrim,
        imieNazwisko: `${imieTrim} ${nazwiskoTrim}`.trim(),
        telefon: formularz.telefon.trim(),
        email: formularz.email.trim(),
        adres: formularz.adres.trim(),
        dataOstatniegoPrzegladu: formularz.dataOstatniegoPrzegladu,
        numeryKotlow,
        numerKotla: numeryKotlow.find((numer) => numer !== "") || "",
        utworzono: serverTimestamp(),
        }),
      );
      setFormularz(PUSTY_FORMULARZ);
      setSukces(zapisano ? "Klient został dodany." : `Klient dodany. ${KOMUNIKAT_ZAPISANO_OFFLINE}`);
    } catch (error) {
      setBlad(komunikatBledu(error));
    } finally {
      setZapisuje(false);
    }
  }

  return (
    <form onSubmit={zapiszKlienta} className="card">
      <h2 className="text-base font-semibold text-slate-900">Nowy klient</h2>
      <fieldset className="mt-6">
        <legend className="text-xs font-semibold uppercase text-slate-500">Rodzaj klienta</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900">
            <input
              type="radio"
              name="rodzajKlienta"
              checked={formularz.rodzaj === "prywatna"}
              onChange={() => zmienRodzaj("prywatna")}
            />
            Osoba prywatna
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900">
            <input
              type="radio"
              name="rodzajKlienta"
              checked={formularz.rodzaj === "firma"}
              onChange={() => zmienRodzaj("firma")}
            />
            Firma
          </label>
        </div>
      </fieldset>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {formularz.rodzaj === "firma" ? (
          <>
            <label className="block text-xs font-semibold uppercase text-slate-500">
              Nazwa firmy
              <input
                name="nazwaFirmy"
                type="text"
                autoComplete="organization"
                value={formularz.nazwaFirmy}
                onChange={(event) => zmienPole("nazwaFirmy", event.target.value)}
                className={klasaPola}
              />
            </label>
            <label className="block text-xs font-semibold uppercase text-slate-500">
              NIP
              <input
                name="nip"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={formularz.nip}
                onChange={(event) => zmienPole("nip", event.target.value)}
                placeholder="10 cyfr"
                className={klasaPola}
              />
            </label>
          </>
        ) : null}
        {POLA.map((pole) => (
          <label key={pole.name} className="block text-xs font-semibold uppercase text-slate-500">
            {pole.label}
            <input
              name={pole.name}
              type={pole.type}
              autoComplete={pole.autoComplete}
              value={formularz[pole.name]}
              onChange={(event) => zmienPole(pole.name, event.target.value)}
              className={klasaPola}
            />
          </label>
        ))}
        {formularz.numeryKotlow.map((numer, indeks) => (
          <label key={`kociol-${indeks}`} className="block text-xs font-semibold uppercase text-slate-500">
            <span className="flex items-center justify-between gap-2">
              Numer kotła {indeks + 1}
              {indeks > 0 ? (
                <button
                  type="button"
                  onClick={() => usunKociol(indeks)}
                  className="text-[11px] font-medium normal-case text-slate-500 hover:text-slate-800"
                >
                  Usuń
                </button>
              ) : null}
            </span>
            <input
              name={`numerKotla${indeks + 1}`}
              type="text"
              value={numer}
              onChange={(event) => zmienKociol(indeks, event.target.value)}
              className={klasaPola}
            />
          </label>
        ))}
      </div>
      {formularz.numeryKotlow.length < MAKS_KOTLOW ? (
        <button
          type="button"
          onClick={dodajKociol}
          className="btn btn-outline mt-6"
        >
          Dodaj kolejny kocioł
        </button>
      ) : null}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={zapisuje}
          className="btn btn-primary"
        >
          {zapisuje ? "Zapisywanie…" : "Dodaj"}
        </button>
        {sukces ? (
          <p role="status" className="text-sm font-medium text-emerald-800">
            {sukces}
          </p>
        ) : null}
        {blad ? (
          <p role="alert" className="text-sm font-medium text-red-700">
            {blad}
          </p>
        ) : null}
      </div>
    </form>
  );
}
