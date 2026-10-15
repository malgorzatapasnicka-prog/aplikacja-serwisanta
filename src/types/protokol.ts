export type CzynnoscProtokolu = "przeglad" | "awaria";

export const ETYKIETY_CZYNNOSCI: Record<CzynnoscProtokolu, string> = {
  przeglad: "Przegląd",
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
};
