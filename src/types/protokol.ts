export type CzynnoscProtokolu = "przeglad" | "awaria";

export type WynikKontroli = "" | "pozytywny" | "negatywny" | "nie_dotyczy";

export type StanCzynnosci = "" | "wykonano" | "nie_dotyczy";

export type StanChecklisty = "" | "wykonano" | "brak" | "wymieniono" | "nie_dotyczy";

export const ETYKIETY_CHECKLISTY: Record<Exclude<StanChecklisty, "">, string> = {
  wykonano: "Wykonano",
  brak: "Brak",
  wymieniono: "Wymieniono",
  nie_dotyczy: "Nie dotyczy",
};

export const GRUPY_CHECKLISTY = [
  {
    tytul: "Pomieszczenie",
    pola: [
      ["kontrolaWentylacji", "Kontrola wentylacji"],
      ["szczelnoscInstalacjiGazowej", "Szczelność instalacji gazowej"],
      ["stanZapylenia", "Stan zapylenia"],
    ],
  },
  {
    tytul: "Instalacje",
    pola: [
      ["filtrGazu", "Filtr gazu"],
      ["filtrZimnejWody", "Filtr zimnej wody"],
      ["filtrNaPowrocie", "Filtr na powrocie"],
      ["odplywKondensatu", "Odpływ kondensatu"],
    ],
  },
  {
    tytul: "Strona wodna",
    pola: [
      ["inspekcjaNieszczelnosci", "Inspekcja nieszczelności"],
      ["plukanieWymiennikaSpaliny", "Płukanie wymiennika spaliny-woda"],
      ["plukanieWymiennikaCwu", "Płukanie wymiennika CWU"],
      ["zaworPrzelaczny", "Zawór przełączny CO-CWU"],
      ["czujnikTempKotla", "Czujnik temp. kotła"],
      ["czujnikTempCwu", "Czujnik temp. CWU"],
      ["zaworBezpieczenstwa", "Zawór bezpieczeństwa"],
    ],
  },
  {
    tytul: "Strona spalinowa",
    pola: [
      ["elektroda", "Elektroda zapłonowa/jonizacyjna"],
      ["izolacjeTermiczne", "Izolacje termiczne"],
      ["zabezpieczeniePrzeplywu", "Zabezpieczenia przed przepływem zwrotnym"],
      ["czyszczenieWymiennikaSpalin", "Czyszczenie wymiennika"],
      ["czyszczeniePalnikaSpalin", "Czyszczenie palnika"],
      ["czyszczenieWentylatora", "Czyszczenie wentylatora"],
      ["analizaSpalin", "Analiza spalin"],
      ["szczelnoscKomina", "Badanie szczelności komina"],
      ["czujnikTempSpalin", "Czujnik temp. spalin"],
    ],
  },
  {
    tytul: "Regulator",
    pola: [
      ["historiaUsterek", "Historia usterek"],
      ["testPrzekaznikow", "Test przekaźników"],
      ["testRealizacjiTemp", "Test realizacji temp. CO i CWU"],
      ["testZabezpieczenTermicznych", "Test zabezpieczeń termicznych"],
      ["przylaczaElektryczne", "Przyłącza elektryczne"],
    ],
  },
] as const;

export type KluczChecklisty = (typeof GRUPY_CHECKLISTY)[number]["pola"][number][0];

export type ChecklistaProtokolu = Partial<Record<KluczChecklisty, StanChecklisty>>;

export const RODZAJE_GAZU = ["GZ50", "GZ35", "GZ41.5", "Propan", "Propan-butan"] as const;

export function stanChecklisty(wartosc: unknown): StanChecklisty {
  if (wartosc === "wykonano" || wartosc === "brak" || wartosc === "wymieniono" || wartosc === "nie_dotyczy") {
    return wartosc;
  }
  return "";
}

export function pustaChecklista(): Record<KluczChecklisty, StanChecklisty> {
  const wynik = {} as Record<KluczChecklisty, StanChecklisty>;
  for (const grupa of GRUPY_CHECKLISTY) {
    for (const [klucz] of grupa.pola) {
      wynik[klucz] = "";
    }
  }
  return wynik;
}

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
  modelUrzadzenia?: string;
  numerFabryczny?: string;
  rodzajGazu?: string;
  opisUslugi?: string;
  uslugaNetto?: number;
  uslugaBrutto?: number;
  dojazdNetto?: number;
  dojazdBrutto?: number;
  materialyNetto?: number;
  materialyBrutto?: number;
  cisnienieGazuStatyczne?: string;
  cisnienieWodyGrzewczej?: string;
  cisnienieWstepneNaczynia?: string;
  checklista?: ChecklistaProtokolu;
  powierzchniaDo300?: boolean;
};
