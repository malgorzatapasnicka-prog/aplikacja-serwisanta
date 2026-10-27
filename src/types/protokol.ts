export type CzynnoscProtokolu = "przeglad" | "awaria";

export type WynikKontroli = "" | "pozytywny" | "negatywny" | "nie_dotyczy";

export type StanCzynnosci = "" | "wykonano" | "nie_dotyczy";

export function wynikKontroli(wartosc: unknown, staryPozytywny = false): WynikKontroli {
  if (wartosc === "pozytywny" || wartosc === "negatywny" || wartosc === "nie_dotyczy") {
    return wartosc;
  }
  return staryPozytywny ? "pozytywny" : "";
}

export function stanCzynnosci(wartosc: unknown): StanCzynnosci {
  if (wartosc === true || wartosc === "wykonano") {
    return "wykonano";
  }
  if (wartosc === "nie_dotyczy") {
    return "nie_dotyczy";
  }
  return "";
}

export const ETYKIETY_CZYNNOSCI: Record<CzynnoscProtokolu, string> = {
  przeglad: "Przegląd okresowy",
  awaria: "Awaria",
};

export type Protokol = {
  id: string;
  nazwaRaportu: string;
  czynnosci: CzynnoscProtokolu;
  status: string;
  typKotla: string;
  mocNominalna: string;
  sterownik: string;
  numerSeryjny: string;
  grzanie: string;
  maksymalnaTemperaturaZasilania: string;
  dataWypelnienia: string;
  numerProtokolu?: string;
  modelKotla?: string;
  numerKotla?: string;
  zadanaTemperaturaGrzania?: string;
  szczelnoscGazowa?: boolean;
  wynikSzczelnosci?: WynikKontroli;
  cisnienieCO?: string;
  cisnienieCONieDotyczy?: boolean;
  zaworKociol?: boolean;
  wynikLancucha?: WynikKontroli;
  cisnienieNaczynia?: string;
  cisnienieNaczyniaNieDotyczy?: boolean;
  czyszczenieWymiennika?: boolean | "nie_dotyczy";
  czyszczeniePalnika?: boolean | "nie_dotyczy";
  sprawdzenieSyfonu?: boolean | "nie_dotyczy";
  inneCzynnosci?: string;
  inneNieDotyczy?: boolean;
  dataKolejnegoPrzegladu?: string;
  kolejnyPrzegladNieDotyczy?: boolean;
  uwagi?: string;
  zdjecia?: string[];
  podpisyZdjec?: string[];
  podpisKlienta?: string;
  podpisSerwisanta?: string;
  maZalacznikPdf?: boolean;
};
