"use client";

import { FirebaseError } from "firebase/app";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { FormEvent, useState } from "react";
import { KOLEKCJE } from "@/lib/collections";
import { getDb } from "@/lib/firebase";

type FormularzKlienta = {
  imie: string;
  nazwisko: string;
  telefon: string;
  email: string;
  adres: string;
  dataOstatniegoPrzegladu: string;
  numerKotla: string;
};

const PUSTY_FORMULARZ: FormularzKlienta = {
  imie: "",
  nazwisko: "",
  telefon: "",
  email: "",
  adres: "",
  dataOstatniegoPrzegladu: "",
  numerKotla: "",
};

const POLA: {
  name: keyof FormularzKlienta;
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
  { name: "numerKotla", label: "Numer kotła", type: "text" },
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

  function zmienPole(name: keyof FormularzKlienta, value: string) {
    setFormularz((aktualny) => ({ ...aktualny, [name]: value }));
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

      await addDoc(collection(db, KOLEKCJE.klienci), {
        imie: imieTrim,
        nazwisko: nazwiskoTrim,
        // zapisujemy również imieNazwisko dla zgodności ze starszymi widokami
        imieNazwisko: `${imieTrim} ${nazwiskoTrim}`.trim(),
        telefon: formularz.telefon.trim(),
        email: formularz.email.trim(),
        adres: formularz.adres.trim(),
        dataOstatniegoPrzegladu: formularz.dataOstatniegoPrzegladu,
        numerKotla: formularz.numerKotla.trim(),
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
      </div>
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