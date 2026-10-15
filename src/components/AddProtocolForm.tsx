"use client";

import { FirebaseError } from "firebase/app";
import { arrayUnion, doc, updateDoc } from "firebase/firestore";
import { FormEvent, useState } from "react";
import { KOLEKCJE } from "@/lib/collections";
import { getDb } from "@/lib/firebase";
import { ETYKIETY_CZYNNOSCI, type CzynnoscProtokolu } from "@/types/protokol";

type AddProtocolFormProps = {
  klientId: string;
  imieNazwisko: string;
  onClose: () => void;
};

type FormularzProtokolu = {
  nazwaRaportu: string;
  czynnosci: CzynnoscProtokolu;
  status: string;
  typKotla: string;
  mocNominalna: string;
  sterownik: string;
  numerSeryjny: string;
  grzanie: string;
  maksymalnaTemperaturaZasilania: string;
};

const PUSTY_FORMULARZ: FormularzProtokolu = {
  nazwaRaportu: "",
  czynnosci: "przeglad",
  status: "",
  typKotla: "",
  mocNominalna: "",
  sterownik: "",
  numerSeryjny: "",
  grzanie: "",
  maksymalnaTemperaturaZasilania: "",
};

const POLA_URZADZENIA: { name: keyof FormularzProtokolu; label: string }[] = [
  { name: "status", label: "Status" },
  { name: "typKotla", label: "Typ kotła" },
  { name: "mocNominalna", label: "Moc nominalna kotła" },
  { name: "sterownik", label: "Sterownik" },
  { name: "numerSeryjny", label: "Nr seryjny" },
];

const POLA_USTAWIEN: { name: keyof FormularzProtokolu; label: string }[] = [
  { name: "grzanie", label: "Grzanie" },
  { name: "maksymalnaTemperaturaZasilania", label: "Maksymalna temperatura zasilania" },
];

function dataWypelnienia() {
  const teraz = new Date();
  const miesiac = String(teraz.getMonth() + 1).padStart(2, "0");
  const dzien = String(teraz.getDate()).padStart(2, "0");
  return `${teraz.getFullYear()}-${miesiac}-${dzien}`;
}

function formatujDate(iso: string) {
  const dopasowanie = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!dopasowanie) {
    return iso;
  }
  return `${dopasowanie[3]}.${dopasowanie[2]}.${dopasowanie[1]}`;
}

function komunikatBledu(error: unknown) {
  if (error instanceof FirebaseError && error.code === "permission-denied") {
    return "Firestore odrzuciło zapis protokołu. W regułach kolekcji klienci zezwól na edycję dokumentów.";
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Nie udało się zapisać protokołu.";
}

const klasaPola =
  "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

export function AddProtocolForm({ klientId, imieNazwisko, onClose }: AddProtocolFormProps) {
  const [formularz, setFormularz] = useState<FormularzProtokolu>(PUSTY_FORMULARZ);
  const [zapisuje, setZapisuje] = useState(false);
  const [blad, setBlad] = useState("");
  const data = dataWypelnienia();

  function zmienPole(name: keyof FormularzProtokolu, value: string) {
    setFormularz((aktualny) => ({ ...aktualny, [name]: value }));
  }

  async function zapiszProtokol(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBlad("");

    const db = getDb();
    if (!db) {
      setBlad("Firebase nie jest skonfigurowany.");
      return;
    }

    setZapisuje(true);

    try {
      await updateDoc(doc(db, KOLEKCJE.klienci, klientId), {
        protokoly: arrayUnion({
          id: crypto.randomUUID(),
          nazwaRaportu: formularz.nazwaRaportu.trim(),
          czynnosci: formularz.czynnosci,
          status: formularz.status.trim(),
          typKotla: formularz.typKotla.trim(),
          mocNominalna: formularz.mocNominalna.trim(),
          sterownik: formularz.sterownik.trim(),
          numerSeryjny: formularz.numerSeryjny.trim(),
          grzanie: formularz.grzanie.trim(),
          maksymalnaTemperaturaZasilania: formularz.maksymalnaTemperaturaZasilania.trim(),
          dataWypelnienia: data,
        }),
      });
      onClose();
    } catch (error) {
      setBlad(komunikatBledu(error));
    } finally {
      setZapisuje(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 p-4">
      <form
        onSubmit={zapiszProtokol}
        className="mx-auto my-4 w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Dodaj protokół</h2>
            <p className="mt-1 text-sm text-slate-600">{imieNazwisko}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            Zamknij
          </button>
        </div>

        <label className="mt-5 block text-sm font-medium text-slate-700">
          Nazwa raportu
          <input
            name="nazwaRaportu"
            required
            value={formularz.nazwaRaportu}
            onChange={(event) => zmienPole("nazwaRaportu", event.target.value)}
            className={klasaPola}
          />
        </label>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-slate-700">Przeprowadzone czynności</legend>
          <div className="mt-2 flex gap-3">
            {(Object.keys(ETYKIETY_CZYNNOSCI) as CzynnoscProtokolu[]).map((wartosc) => (
              <label
                key={wartosc}
                className="flex min-h-11 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
              >
                <input
                  type="radio"
                  name="czynnosci"
                  value={wartosc}
                  checked={formularz.czynnosci === wartosc}
                  onChange={() => zmienPole("czynnosci", wartosc)}
                />
                {ETYKIETY_CZYNNOSCI[wartosc]}
              </label>
            ))}
          </div>
        </fieldset>

        <h3 className="mt-6 text-sm font-semibold tracking-wide text-slate-900 uppercase">
          Dane urządzenia
        </h3>
        <div className="mt-3 grid gap-4">
          {POLA_URZADZENIA.map((pole) => (
            <label key={pole.name} className="block text-sm font-medium text-slate-700">
              {pole.label}
              <input
                name={pole.name}
                required
                value={formularz[pole.name]}
                onChange={(event) => zmienPole(pole.name, event.target.value)}
                className={klasaPola}
              />
            </label>
          ))}
        </div>

        <h3 className="mt-6 text-sm font-semibold tracking-wide text-slate-900 uppercase">
          Ustawienia urządzenia
        </h3>
        <div className="mt-3 grid gap-4">
          {POLA_USTAWIEN.map((pole) => (
            <label key={pole.name} className="block text-sm font-medium text-slate-700">
              {pole.label}
              <input
                name={pole.name}
                required
                value={formularz[pole.name]}
                onChange={(event) => zmienPole(pole.name, event.target.value)}
                className={klasaPola}
              />
            </label>
          ))}
        </div>

        <p className="mt-5 text-sm text-slate-600">Data wypełnienia: {formatujDate(data)}</p>

        {blad ? (
          <p role="alert" className="mt-3 text-sm font-medium text-red-700">
            {blad}
          </p>
        ) : null}

        <div className="mt-5 flex gap-3">
          <button
            type="submit"
            disabled={zapisuje}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:bg-slate-400"
          >
            {zapisuje ? "Zapisywanie…" : "Zapisz protokół"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Anuluj
          </button>
        </div>
      </form>
    </div>
  );
}
