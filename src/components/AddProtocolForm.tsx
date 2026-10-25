"use client";

import { FirebaseError } from "firebase/app";
import { arrayUnion, deleteDoc, doc, setDoc, updateDoc } from "firebase/firestore";
import { ChangeEvent, FormEvent, useState, type ReactNode } from "react";
import { KOLEKCJE } from "@/lib/collections";
import { getDb } from "@/lib/firebase";
import { numerProtokoluZDaty } from "@/lib/widokProtokolu";
import { PodpisNaEkranie } from "@/components/PodpisNaEkranie";
import { ETYKIETY_CZYNNOSCI, type CzynnoscProtokolu } from "@/types/protokol";

type AddProtocolFormProps = {
  klientId: string;
  imieNazwisko: string;
  numerKotla?: string;
  nazwaKotla?: string;
  kolejnyNumer?: number;
  onClose: () => void;
};

type FormularzProtokolu = {
  nazwaRaportu: string;
  dataPrzegladu: string;
  czynnosci: CzynnoscProtokolu;
  modelKotla: string;
  numerKotla: string;
  mocNominalna: string;
  sterownik: string;
  zadanaTemperaturaGrzania: string;
  maksymalnaTemperaturaZasilania: string;
  status: string;
  szczelnoscGazowa: boolean;
  cisnienieCO: string;
  zaworKociol: boolean;
  cisnienieNaczynia: string;
  czyszczenieWymiennika: boolean;
  czyszczeniePalnika: boolean;
  sprawdzenieSyfonu: boolean;
  inneCzynnosci: string;
  dataKolejnegoPrzegladu: string;
  uwagi: string;
};

const klasaPola =
  "mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

function dzis() {
  const teraz = new Date();
  const miesiac = String(teraz.getMonth() + 1).padStart(2, "0");
  const dzien = String(teraz.getDate()).padStart(2, "0");
  return `${teraz.getFullYear()}-${miesiac}-${dzien}`;
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

type ZdjecieFormularza = {
  src: string;
  podpis: string;
};

const LIMIT_ZDJECIA = 10;

function rysujNaPlotnie(zrodlo: CanvasImageSource, szerokoscZrodla: number, wysokoscZrodla: number) {
  const maks = 900;
  const skala = Math.min(1, maks / Math.max(szerokoscZrodla, wysokoscZrodla));
  const szerokosc = Math.max(1, Math.round(szerokoscZrodla * skala));
  const wysokosc = Math.max(1, Math.round(wysokoscZrodla * skala));
  const plotno = document.createElement("canvas");
  plotno.width = szerokosc;
  plotno.height = wysokosc;
  const kontekst = plotno.getContext("2d");
  if (!kontekst) {
    throw new Error("Nie udało się przygotować zdjęcia.");
  }
  kontekst.fillStyle = "#ffffff";
  kontekst.fillRect(0, 0, szerokosc, wysokosc);
  kontekst.drawImage(zrodlo, 0, 0, szerokosc, wysokosc);
  return plotno.toDataURL("image/jpeg", 0.55);
}

function wymiaryPrzezObraz(plik: Blob) {
  return new Promise<string>((resolve, reject) => {
    const adres = URL.createObjectURL(plik);
    const obraz = new Image();
    obraz.onload = () => {
      try {
        resolve(rysujNaPlotnie(obraz, obraz.naturalWidth, obraz.naturalHeight));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(adres);
      }
    };
    obraz.onerror = () => {
      URL.revokeObjectURL(adres);
      reject(new Error("Nie udało się odczytać zdjęcia."));
    };
    obraz.src = adres;
  });
}

async function kompresujZdjecie(plik: File) {
  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(plik, { imageOrientation: "from-image" });
      try {
        return rysujNaPlotnie(bitmap, bitmap.width, bitmap.height);
      } finally {
        bitmap.close();
      }
    }
  } catch {
    // HEIC z iPhone'a często nie przechodzi przez canvas. Wtedy konwersja niżej.
  }

  try {
    return await wymiaryPrzezObraz(plik);
  } catch {
    const heic2any = (await import("heic2any")).default;
    const wynik = await heic2any({ blob: plik, toType: "image/jpeg", quality: 0.55 });
    const jpeg = Array.isArray(wynik) ? wynik[0] : wynik;
    return wymiaryPrzezObraz(jpeg);
  }
}

function Pole({
  etykieta,
  wymagane = true,
  children,
}: {
  etykieta: string;
  wymagane?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {etykieta}
      {wymagane ? null : <span className="font-normal text-slate-400"> (opcjonalnie)</span>}
      {children}
    </label>
  );
}

function Kratka({
  etykieta,
  zaznaczone,
  onChange,
}: {
  etykieta: string;
  zaznaczone: boolean;
  onChange: (zaznaczone: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800">
      <input type="checkbox" checked={zaznaczone} onChange={(event) => onChange(event.target.checked)} />
      {etykieta}
    </label>
  );
}

export function AddProtocolForm({
  klientId,
  imieNazwisko,
  numerKotla = "",
  nazwaKotla = "",
  kolejnyNumer = 1,
  onClose,
}: AddProtocolFormProps) {
  const [formularz, setFormularz] = useState<FormularzProtokolu>({
    nazwaRaportu: "",
    dataPrzegladu: dzis(),
    czynnosci: "przeglad",
    modelKotla: nazwaKotla,
    numerKotla,
    mocNominalna: "",
    sterownik: "",
    zadanaTemperaturaGrzania: "",
    maksymalnaTemperaturaZasilania: "",
    status: "",
    szczelnoscGazowa: false,
    cisnienieCO: "",
    zaworKociol: false,
    cisnienieNaczynia: "",
    czyszczenieWymiennika: false,
    czyszczeniePalnika: false,
    sprawdzenieSyfonu: false,
    inneCzynnosci: "",
    dataKolejnegoPrzegladu: "",
    uwagi: "",
  });
  const [zdjecia, setZdjecia] = useState<ZdjecieFormularza[]>([]);
  const [zalacznikPdf, setZalacznikPdf] = useState("");
  const [nazwaZalacznika, setNazwaZalacznika] = useState("");
  const [podpisKlienta, setPodpisKlienta] = useState("");
  const [przetwarzamZdjecie, setPrzetwarzamZdjecie] = useState(false);
  const [zapisuje, setZapisuje] = useState(false);
  const [blad, setBlad] = useState("");

  function zmienPole<K extends keyof FormularzProtokolu>(name: K, value: FormularzProtokolu[K]) {
    setFormularz((aktualny) => ({ ...aktualny, [name]: value }));
  }

  async function handleZdjecia(event: ChangeEvent<HTMLInputElement>) {
    const pliki = [...(event.target.files ?? [])];
    event.target.value = "";
    if (pliki.length === 0) {
      return;
    }

    const wolne = LIMIT_ZDJECIA - zdjecia.length;
    if (wolne <= 0) {
      setBlad("Można dodać najwyżej 10 zdjęć.");
      return;
    }

    const wybrane = pliki.slice(0, wolne);
    setPrzetwarzamZdjecie(true);
    setBlad("");
    try {
      const nowe: ZdjecieFormularza[] = [];
      for (const plik of wybrane) {
        nowe.push({ src: await kompresujZdjecie(plik), podpis: "" });
      }
      setZdjecia((aktualne) => [...aktualne, ...nowe].slice(0, LIMIT_ZDJECIA));
      if (pliki.length > wolne) {
        setBlad(`Wybrano za dużo plików. Dodano ${wybrane.length}, limit to 10 zdjęć.`);
      }
    } catch {
      setBlad("Nie udało się odczytać zdjęcia. Wybierz JPEG, PNG albo HEIC z iPhone’a.");
    } finally {
      setPrzetwarzamZdjecie(false);
    }
  }

  async function handleZalacznik(event: ChangeEvent<HTMLInputElement>) {
    const plik = event.target.files?.[0];
    event.target.value = "";
    if (!plik) {
      return;
    }
    const toPdf = plik.type === "application/pdf" || plik.name.toLowerCase().endsWith(".pdf");
    if (!toPdf) {
      setBlad("Załącznik musi być plikiem PDF.");
      return;
    }
    if (plik.size > 700_000) {
      setBlad("Załącznik PDF jest za duży. Maksymalny rozmiar to 700 KB.");
      return;
    }

    setBlad("");
    try {
      const dane = await plik.arrayBuffer();
      const naglowek = new TextDecoder().decode(dane.slice(0, 5));
      if (!naglowek.startsWith("%PDF")) {
        setBlad("Wybrany plik nie jest dokumentem PDF.");
        return;
      }
      const base64 = btoa(new Uint8Array(dane).reduce((wynik, bajt) => wynik + String.fromCharCode(bajt), ""));
      setZalacznikPdf(`data:application/pdf;base64,${base64}`);
      setNazwaZalacznika(plik.name);
    } catch {
      setBlad("Nie udało się odczytać załącznika PDF.");
    }
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
    const model = formularz.modelKotla.trim();
    const numer = formularz.numerKotla.trim();
    const temperatura = formularz.zadanaTemperaturaGrzania.trim();
    const protokolId = crypto.randomUUID();

    try {
      if (zalacznikPdf) {
        await setDoc(doc(db, KOLEKCJE.zalacznikiProtokolu, protokolId), {
          klientId,
          pdf: zalacznikPdf,
        });
      }
      await updateDoc(doc(db, KOLEKCJE.klienci, klientId), {
        protokoly: arrayUnion({
          id: protokolId,
          nazwaRaportu: formularz.nazwaRaportu.trim(),
          czynnosci: formularz.czynnosci,
          status: formularz.status.trim(),
          typKotla: model,
          mocNominalna: formularz.mocNominalna.trim(),
          sterownik: formularz.sterownik.trim(),
          numerSeryjny: numer,
          grzanie: temperatura,
          maksymalnaTemperaturaZasilania: formularz.maksymalnaTemperaturaZasilania.trim(),
          dataWypelnienia: formularz.dataPrzegladu,
          numerProtokolu: numerProtokoluZDaty(formularz.dataPrzegladu, kolejnyNumer),
          modelKotla: model,
          numerKotla: numer,
          zadanaTemperaturaGrzania: temperatura,
          szczelnoscGazowa: formularz.szczelnoscGazowa,
          cisnienieCO: formularz.cisnienieCO.trim(),
          zaworKociol: formularz.zaworKociol,
          cisnienieNaczynia: formularz.cisnienieNaczynia.trim(),
          czyszczenieWymiennika: formularz.czyszczenieWymiennika,
          czyszczeniePalnika: formularz.czyszczeniePalnika,
          sprawdzenieSyfonu: formularz.sprawdzenieSyfonu,
          inneCzynnosci: formularz.inneCzynnosci.trim(),
          dataKolejnegoPrzegladu: formularz.dataKolejnegoPrzegladu,
          uwagi: formularz.uwagi.trim(),
          zdjecia: zdjecia.slice(0, LIMIT_ZDJECIA).map((zdjecie) => zdjecie.src),
          podpisyZdjec: zdjecia.slice(0, LIMIT_ZDJECIA).map((zdjecie) => zdjecie.podpis.trim()),
          ...(podpisKlienta ? { podpisKlienta } : {}),
          maZalacznikPdf: Boolean(zalacznikPdf),
        }),
      });
      onClose();
    } catch (error) {
      if (zalacznikPdf) {
        await deleteDoc(doc(db, KOLEKCJE.zalacznikiProtokolu, protokolId)).catch(() => undefined);
      }
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
            <p className="mt-1 text-sm font-medium text-slate-800">
              Nr protokołu: {numerProtokoluZDaty(formularz.dataPrzegladu, kolejnyNumer)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">
            Zamknij
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <Pole etykieta="Nazwa raportu">
            <input
              required
              value={formularz.nazwaRaportu}
              onChange={(event) => zmienPole("nazwaRaportu", event.target.value)}
              className={klasaPola}
              placeholder="np. Przegląd roczny"
            />
          </Pole>
          <Pole etykieta="Data przeglądu">
            <input
              type="date"
              required
              value={formularz.dataPrzegladu}
              onChange={(event) => zmienPole("dataPrzegladu", event.target.value)}
              className={klasaPola}
            />
          </Pole>
        </div>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-slate-700">Przegląd okresowy / awaria</legend>
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
          1. Identyfikacja i ustawienia urządzenia
        </h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Pole etykieta="Model kotła">
            <input required value={formularz.modelKotla} onChange={(event) => zmienPole("modelKotla", event.target.value)} className={klasaPola} />
          </Pole>
          <Pole etykieta="Numer kotła">
            <input required value={formularz.numerKotla} onChange={(event) => zmienPole("numerKotla", event.target.value)} className={klasaPola} />
          </Pole>
          <Pole etykieta="Moc nominalna">
            <input
              required
              value={formularz.mocNominalna}
              onChange={(event) => zmienPole("mocNominalna", event.target.value)}
              className={klasaPola}
              placeholder="460 kW"
            />
          </Pole>
          <Pole etykieta="Typ sterownika">
            <input
              required
              value={formularz.sterownik}
              onChange={(event) => zmienPole("sterownik", event.target.value)}
              className={klasaPola}
              placeholder="brak"
            />
          </Pole>
          <Pole etykieta="Zadana temp. grzania">
            <input
              required
              value={formularz.zadanaTemperaturaGrzania}
              onChange={(event) => zmienPole("zadanaTemperaturaGrzania", event.target.value)}
              className={klasaPola}
              placeholder="25"
            />
          </Pole>
          <Pole etykieta="Maks. temp. zasilania">
            <input
              required
              value={formularz.maksymalnaTemperaturaZasilania}
              onChange={(event) => zmienPole("maksymalnaTemperaturaZasilania", event.target.value)}
              className={klasaPola}
              placeholder="25"
            />
          </Pole>
          <Pole etykieta="Status urządzenia">
            <input
              required
              value={formularz.status}
              onChange={(event) => zmienPole("status", event.target.value)}
              className={klasaPola}
              placeholder="ERROR / Usterka"
            />
          </Pole>
        </div>

        <h3 className="mt-6 text-sm font-semibold tracking-wide text-slate-900 uppercase">
          2. Test bezpieczeństwa i szczelności
        </h3>
        <div className="mt-3 grid gap-4">
          <Kratka
            etykieta="Szczelność instalacji gazowej — pozytywny"
            zaznaczone={formularz.szczelnoscGazowa}
            onChange={(zaznaczone) => zmienPole("szczelnoscGazowa", zaznaczone)}
          />
          <Pole etykieta="Ciśnienie w instalacji C.O. (bar)" wymagane={false}>
            <input value={formularz.cisnienieCO} onChange={(event) => zmienPole("cisnienieCO", event.target.value)} className={klasaPola} />
          </Pole>
          <Kratka
            etykieta="Zawór - kocioł"
            zaznaczone={formularz.zaworKociol}
            onChange={(zaznaczone) => zmienPole("zaworKociol", zaznaczone)}
          />
          <Pole etykieta="Ciśnienie wstępne w naczyniu wzbiorczym (bar)" wymagane={false}>
            <input
              value={formularz.cisnienieNaczynia}
              onChange={(event) => zmienPole("cisnienieNaczynia", event.target.value)}
              className={klasaPola}
            />
          </Pole>
        </div>

        <h3 className="mt-6 text-sm font-semibold tracking-wide text-slate-900 uppercase">
          3. Lista kontrolna wykonanych czynności
        </h3>
        <div className="mt-3 grid gap-3">
          <Kratka
            etykieta="Czyszczenie wymiennika ciepła"
            zaznaczone={formularz.czyszczenieWymiennika}
            onChange={(zaznaczone) => zmienPole("czyszczenieWymiennika", zaznaczone)}
          />
          <Kratka
            etykieta="Czyszczenie palnika i elektrod"
            zaznaczone={formularz.czyszczeniePalnika}
            onChange={(zaznaczone) => zmienPole("czyszczeniePalnika", zaznaczone)}
          />
          <Kratka
            etykieta="Sprawdzenie syfonu kondensatu"
            zaznaczone={formularz.sprawdzenieSyfonu}
            onChange={(zaznaczone) => zmienPole("sprawdzenieSyfonu", zaznaczone)}
          />
          <Pole etykieta="Inne" wymagane={false}>
            <input value={formularz.inneCzynnosci} onChange={(event) => zmienPole("inneCzynnosci", event.target.value)} className={klasaPola} />
          </Pole>
          <Pole etykieta="Data kolejnego przeglądu" wymagane={false}>
            <input
              type="date"
              value={formularz.dataKolejnegoPrzegladu}
              onChange={(event) => zmienPole("dataKolejnegoPrzegladu", event.target.value)}
              className={klasaPola}
            />
          </Pole>
        </div>

        <h3 className="mt-6 text-sm font-semibold tracking-wide text-slate-900 uppercase">
          4. Uwagi serwisanta i zdiagnozowane usterki
        </h3>
        <textarea value={formularz.uwagi} onChange={(event) => zmienPole("uwagi", event.target.value)} rows={5} className={`${klasaPola} mt-3`} />

        <h3 className="mt-6 text-sm font-semibold tracking-wide text-slate-900 uppercase">5. Analiza spalin</h3>
        <p className="mt-1 text-xs text-slate-500">
          Do 10 zdjęć z analizatora albo aparatu. W galerii można zaznaczyć kilka naraz. Pliki HEIC z iPhone’a są zapisywane jako JPEG.
        </p>
        <p className="mt-1 text-sm font-medium text-slate-700">
          {zdjecia.length} / {LIMIT_ZDJECIA}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">
            Zrób zdjęcie
            <input type="file" accept="image/*,.heic,.heif" capture="environment" className="hidden" onChange={handleZdjecia} />
          </label>
          <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
            Wybierz z galerii
            <input type="file" accept="image/*,.heic,.heif" multiple className="hidden" onChange={handleZdjecia} />
          </label>
        </div>
        {przetwarzamZdjecie ? <p className="mt-3 text-sm text-slate-600">Przetwarzanie zdjęć…</p> : null}
        {zdjecia.length > 0 ? (
          <div className="mt-3 grid gap-3">
            {zdjecia.map((zdjecie, indeks) => (
              <div key={`${indeks}-${zdjecie.src.slice(0, 32)}`} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={zdjecie.src} alt={`Zdjęcie nr ${indeks + 1}`} className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-slate-800">Zdjęcie nr {indeks + 1}</p>
                      <button
                        type="button"
                        onClick={() => setZdjecia((aktualne) => aktualne.filter((_, numer) => numer !== indeks))}
                        className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white"
                      >
                        ✕
                      </button>
                    </div>
                    <input
                      value={zdjecie.podpis}
                      onChange={(event) =>
                        setZdjecia((aktualne) =>
                          aktualne.map((pozycja, numer) =>
                            numer === indeks ? { ...pozycja, podpis: event.target.value } : pozycja,
                          ),
                        )
                      }
                      className={klasaPola}
                      placeholder="Podpis (opcjonalnie)"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <h3 className="mt-6 text-sm font-semibold tracking-wide text-slate-900 uppercase">Załącznik PDF</h3>
        <p className="mt-1 text-xs text-slate-500">
          Opcjonalnie. Strony tego pliku zostaną dodane na końcu gotowego protokołu.
        </p>
        <label className="mt-3 inline-flex cursor-pointer items-center rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
          Wybierz PDF
          <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleZalacznik} />
        </label>
        {nazwaZalacznika ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2">
            <p className="min-w-0 truncate text-sm text-slate-800">{nazwaZalacznika}</p>
            <button
              type="button"
              onClick={() => {
                setZalacznikPdf("");
                setNazwaZalacznika("");
              }}
              className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white"
            >
              ✕
            </button>
          </div>
        ) : null}

        <PodpisNaEkranie onChange={setPodpisKlienta} />

        {blad ? (
          <p role="alert" className="mt-4 text-sm font-medium text-red-700">
            {blad}
          </p>
        ) : null}

        <div className="mt-5 flex gap-3">
          <button
            type="submit"
            disabled={zapisuje || przetwarzamZdjecie}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-400"
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
