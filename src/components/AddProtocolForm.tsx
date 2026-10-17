"use client";

import { FirebaseError } from "firebase/app";
import { arrayUnion, doc, updateDoc } from "firebase/firestore";
import { ChangeEvent, FormEvent, useState } from "react";
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

function kompresujZdjecie(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxWymiar = 1024;
        let szerokosc = img.width;
        let wysokosc = img.height;

        if (szerokosc > wysokosc) {
          if (szerokosc > maxWymiar) {
            wysokosc = Math.round((wysokosc * maxWymiar) / szerokosc);
            szerokosc = maxWymiar;
          }
        } else {
          if (wysokosc > maxWymiar) {
            szerokosc = Math.round((szerokosc * maxWymiar) / wysokosc);
            wysokosc = maxWymiar;
          }
        }

        canvas.width = szerokosc;
        canvas.height = wysokosc;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, szerokosc, wysokosc);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

const klasaPola =
  "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

export function AddProtocolForm({ klientId, imieNazwisko, onClose }: AddProtocolFormProps) {
  const [formularz, setFormularz] = useState<FormularzProtokolu>(PUSTY_FORMULARZ);
  const [zdjecia, setZdjecia] = useState<string[]>([]);
  const [przetwarzamZdjecia, setPrzetwarzamZdjecia] = useState(false);
  const [zapisuje, setZapisuje] = useState(false);
  const [blad, setBlad] = useState("");
  const data = dataWypelnienia();

  function zmienPole(name: keyof FormularzProtokolu, value: string) {
    setFormularz((aktualny) => ({ ...aktualny, [name]: value }));
  }

  async function handleDodajZdjecia(e: ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return;
    setPrzetwarzamZdjecia(true);
    try {
      const pliki = Array.from(e.target.files);
      const noweZdjecia: string[] = [];
      for (const plik of pliki) {
        const skompresowane = await kompresujZdjecie(plik);
        noweZdjecia.push(skompresowane);
      }
      setZdjecia((poprzednie) => [...poprzednie, ...noweZdjecia]);
    } catch {
      alert("Wystąpił problem podczas przetwarzania zdjęć.");
    } finally {
      setPrzetwarzamZdjecia(false);
      e.target.value = "";
    }
  }

  function usunZdjecie(index: number) {
    setZdjecia((poprzednie) => poprzednie.filter((_, i) => i !== index));
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
          zdjecia: zdjecia,
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
            placeholder="np. Przegląd roczny kotła"
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

        {/* Widoczna sekcja: Zdjęcia z aparatu i galerii */}
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                📷 Dokumentacja zdjęciowa
              </h3>
              <p className="text-xs text-stone-600 mt-0.5">
                Zrób zdjęcie aparatem telefonu lub załącz z galerii
              </p>
            </div>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-xs font-bold text-stone-950 shadow-sm transition hover:bg-amber-400 active:scale-95">
              <span>📸 Otwórz aparat / Dodaj</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={handleDodajZdjecia}
                className="hidden"
              />
            </label>
          </div>

          {przetwarzamZdjecia && (
            <p className="mt-3 text-xs font-semibold text-amber-800 animate-pulse">
              ⏳ Przetwarzanie i kompresja zdjęć...
            </p>
          )}

          {zdjecia.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {zdjecia.map((src, i) => (
                <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border border-stone-300 bg-white shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Zdjęcie ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => usunZdjecie(i)}
                    className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white shadow hover:bg-red-700"
                    title="Usuń zdjęcie"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
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
            disabled={zapisuje || przetwarzamZdjecia}
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