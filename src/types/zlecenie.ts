export const STATUSY_ZLECENIA = {
  nowe: "Nowe",
  w_trakcie: "W trakcie",
  zakonczone: "Zakończone",
  anulowane: "Anulowane",
} as const;

export type StatusZlecenia = keyof typeof STATUSY_ZLECENIA;

export type Zlecenie = {
  id: string;
  klientId: string;
  tytul: string;
  opis: string;
  status: StatusZlecenia;
  termin: string;
  utworzono: string;
};
