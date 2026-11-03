import type { Protokol } from "@/types/protokol";

export type Klient = {
  id: string;
  imieNazwisko: string;
  telefon: string;
  email: string;
  adres: string;
  dataOstatniegoPrzegladu: string;
  /** Data przeglądu, dla której wysłano już SMS „za 3 miesiące”. */
  smsPrzypomnienieDlaDaty?: string;
  smsPrzypomnienieWyslano?: string;
  numerKotla: string;
  nazwaKotla: string;
  protokoly: Protokol[];
  utworzono: string;
};
