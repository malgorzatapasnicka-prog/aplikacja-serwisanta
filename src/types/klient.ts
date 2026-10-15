import type { Protokol } from "@/types/protokol";

export type Klient = {
  id: string;
  imieNazwisko: string;
  telefon: string;
  email: string;
  adres: string;
  dataOstatniegoPrzegladu: string;
  numerKotla: string;
  nazwaKotla: string;
  protokoly: Protokol[];
  utworzono: string;
};
