export type CzynnoscProtokolu = "przeglad" | "awaria";

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
  cisnienieCO?: string;
  zaworKociol?: boolean;
  cisnienieNaczynia?: string;
  czyszczenieWymiennika?: boolean;
  czyszczeniePalnika?: boolean;
  sprawdzenieSyfonu?: boolean;
  inneCzynnosci?: string;
  dataKolejnegoPrzegladu?: string;
  uwagi?: string;
  zdjecia?: string[];
  podpisyZdjec?: string[];
};
