export type CzescMagazynowa = {
  id: string;
  nazwa: string;
  kodKatalogowy: string;
  producent: string;
  kategoria: string;
  ilosc: number;
  jednostka: string;
  cenaZakupuNetto: number;
};

/** Wartość pozycji w groszach, żeby sumy nie łapały błędów zaokrągleń. */
export function wartoscWGroszach(czesc: Pick<CzescMagazynowa, "ilosc" | "cenaZakupuNetto">) {
  return Math.round(czesc.ilosc * Math.round(czesc.cenaZakupuNetto * 100));
}

export function sumaWGroszach(czesci: readonly Pick<CzescMagazynowa, "ilosc" | "cenaZakupuNetto">[]) {
  return czesci.reduce((suma, czesc) => suma + wartoscWGroszach(czesc), 0);
}

export function formatujIlosc(ilosc: number) {
  return ilosc.toLocaleString("pl-PL", { maximumFractionDigits: 3 });
}

export function formatujKwoteZl(kwota: number) {
  return `${kwota.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}
