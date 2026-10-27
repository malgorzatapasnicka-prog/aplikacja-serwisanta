"use client";

import { FirebaseError } from "firebase/app";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { FormEvent, useState } from "react";
import { KOLEKCJE } from "@/lib/collections";
import { getDb } from "@/lib/firebase";

const MAKS_KOTLOW = 5;

type FormularzKlienta = {
  imie: string;
  nazwisko: string;
  telefon: string;
  email: string;
  adres: string;
  dataOstatniegoPrzegladu: string;
  numeryKotlow: string[];
};

type PoleTekstowe = Exclude<keyof FormularzKlienta, "numeryKotlow">;

const PUSTY_FORMULARZ: FormularzKlienta = {
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
      const numeryKotlow = formularz.numeryKotlow.map((numer) => numer.trim()).slice(0, MAKS_KOTLOW);
      while (numeryKotlow.length > 0 && numeryKotlow[numeryKotlow.length - 1] === "") {
        numeryKotlow.pop();
      }

      await addDoc(collection(db, KOLEKCJE.klienci), {
        imie: imieTrim,
        nazwisko: nazwiskoTrim,
        // zapisujemy również imieNazwisko dla zgodności ze starszymi widokami
        imieNazwisko: `${imieTrim} ${nazwiskoTrim}`.trim(),
        telefon: formularz.telefon.trim(),
        email: formularz.email.trim(),
        adres: formularz.adres.trim(),
        dataOstatniegoPrzegladu: formularz.dataOstatniegoPrzegladu,
        numeryKotlow,
        numerKotla: numeryKotlow.find((numer) => numer !== "") || "",
        utworzono: serverTimestamp(),
      });
      setFormularz(PUSTY_FORMULARZ);
      setSukces("Klient został dodany.");
    } catch (error) {
      setBlad(komunikatBledu(error));
    } finally {
      setZapisuje(false);
    }
  }

  return (
    <form
      onSubmit={zapiszKlienta}
      className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
    >
      <h2 className="text-base font-semibold text-gray-900">Nowy klient</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {POLA.map((pole) => (
          <label key={pole.name} className="block text-xs font-semibold uppercase text-gray-500">
            {pole.label}
            <input
              name={pole.name}
              type={pole.type}
              autoComplete={pole.autoComplete}
              value={formularz[pole.name]}
              onChange={(event) => zmienPole(pole.name, event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 outline-none focus:border-gray-400"
            />
          </label>
        ))}
        {formularz.numeryKotlow.map((numer, indeks) => (
          <label key={`kociol-${indeks}`} className="block text-xs font-semibold uppercase text-gray-500">
            <span className="flex items-center justify-between gap-2">
              Numer kotła {indeks + 1}
              {indeks > 0 ? (
                <button
                  type="button"
                  onClick={() => usunKociol(indeks)}
                  className="text-[11px] font-medium normal-case text-gray-500 hover:text-gray-800"
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
              className="mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 outline-none focus:border-gray-400"
            />
          </label>
        ))}
      </div>
      {formularz.numeryKotlow.length < MAKS_KOTLOW ? (
        <button
          type="button"
          onClick={dodajKociol}
          className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Dodaj kolejny kocioł
        </button>
      ) : null}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={zapisuje}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
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