/**
 * Rozliczenie protokołu (kwoty usługi, dojazdu i części) jest informacją tylko dla serwisanta.
 * Nie trafia do PDF-ów dla klienta. Tu jest wspólna logika: pozycje, sumy i formatowanie kwot.
 */

export type KwotyProtokolu = {
  uslugaNetto?: number;
  uslugaBrutto?: number;
  dojazdNetto?: number;
  dojazdBrutto?: number;
  materialyNetto?: number;
  materialyBrutto?: number;
  opisUslugi?: string;
};

export type KluczPozycji = "usluga" | "dojazd" | "materialy";

export type PozycjaRozliczenia = {
  klucz: KluczPozycji;
  nazwa: string;
  netto?: number;
  brutto?: number;
};

export const POZYCJE_ROZLICZENIA: ReadonlyArray<{ klucz: KluczPozycji; nazwa: string }> = [
  { klucz: "usluga", nazwa: "Usługa" },
  { klucz: "dojazd", nazwa: "Dojazd" },
  { klucz: "materialy", nazwa: "Części/Materiały" },
];

function liczba(wartosc: unknown) {
  return typeof wartosc === "number" && Number.isFinite(wartosc) ? wartosc : undefined;
}

/** Wszystkie trzy pozycje (usługa, dojazd, części) z kwotami, jeśli zostały wpisane. */
export function wszystkiePozycje(protokol: KwotyProtokolu): PozycjaRozliczenia[] {
  return [
    { klucz: "usluga", nazwa: "Usługa", netto: liczba(protokol.uslugaNetto), brutto: liczba(protokol.uslugaBrutto) },
    { klucz: "dojazd", nazwa: "Dojazd", netto: liczba(protokol.dojazdNetto), brutto: liczba(protokol.dojazdBrutto) },
    {
      klucz: "materialy",
      nazwa: "Części/Materiały",
      netto: liczba(protokol.materialyNetto),
      brutto: liczba(protokol.materialyBrutto),
    },
  ];
}

/** Tylko pozycje, w których wpisano jakąkolwiek kwotę. */
export function pozycjeRozliczenia(protokol: KwotyProtokolu) {
  return wszystkiePozycje(protokol).filter((pozycja) => pozycja.netto !== undefined || pozycja.brutto !== undefined);
}

export function maRozliczenie(protokol: KwotyProtokolu) {
  return pozycjeRozliczenia(protokol).length > 0;
}

/** Suma kwot liczona w groszach, żeby uniknąć błędów zaokrągleń (0,1 + 0,2). */
export function sumujKwoty(kwoty: ReadonlyArray<number | undefined>) {
  const grosze = kwoty.reduce<number>((suma, kwota) => suma + (kwota === undefined ? 0 : Math.round(kwota * 100)), 0);
  return grosze / 100;
}

export function sumaProtokolu(protokol: KwotyProtokolu) {
  const pozycje = wszystkiePozycje(protokol);
  return {
    netto: sumujKwoty(pozycje.map((pozycja) => pozycja.netto)),
    brutto: sumujKwoty(pozycje.map((pozycja) => pozycja.brutto)),
  };
}

export function formatujKwote(kwota: number | undefined) {
  if (kwota === undefined) {
    return "—";
  }
  return `${kwota.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}
