import { formatujDateIso, type DaneProtokoluPdf } from "@/lib/daneProtokolu";
import { FIRMA } from "@/lib/firma";

export type PozycjaListy = {
  etykieta: string;
  wykonano: boolean;
};

export type WidokProtokolu = {
  dataPrzegladu: string;
  numerProtokolu: string;
  podtytul: string;
  serwisantNazwa: string;
  serwisantTelefon: string;
  serwisantEmail: string;
  klientNazwa: string;
  klientLinie: string[];
  modelKotla: string;
  numerKotla: string;
  mocNominalna: string;
  sterownik: string;
  zadanaTemperatura: string;
  maksTemperatura: string;
  status: string;
  statusAwaria: boolean;
  szczelnoscGazowa: boolean;
  cisnienieCO: string;
  zaworKociol: boolean;
  cisnienieNaczynia: string;
  czynnosci: PozycjaListy[];
  inneCzynnosci: string;
  dataKolejnegoPrzegladu: string;
  uwagi: string;
  zdjecia: string[];
  podpisyZdjec: string[];
  podpisKlienta: string;
  podpisSerwisanta: string;
};

export function numerProtokoluZDaty(dataIso: string, kolejny: number) {
  const dopasowanie = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataIso);
  const rok = dopasowanie?.[1] ?? "0000";
  const miesiac = dopasowanie?.[2] ?? "00";
  const numer = String(Math.max(1, kolejny)).padStart(3, "0");
  return `PR/${rok}/${miesiac}/${numer}`;
}

export function nastepnyNumerProtokolu(dataIso: string, istniejace: string[]) {
  const data = /^(\d{4})-(\d{2})-\d{2}$/.exec(dataIso);
  const rok = data?.[1] ?? "0000";
  const miesiac = data?.[2] ?? "00";
  const najwyzszy = istniejace.reduce((max, numer) => {
    const dopasowanie = /^PR\/(\d{4})\/(\d{2})\/(\d+)$/.exec(numer.trim());
    if (!dopasowanie || dopasowanie[1] !== rok || dopasowanie[2] !== miesiac) {
      return max;
    }
    return Math.max(max, Number(dopasowanie[3]));
  }, 0);
  return numerProtokoluZDaty(dataIso, najwyzszy + 1);
}

export function linieAdresu(adres: string) {
  return adres
    .split(",")
    .map((linia) => linia.trim())
    .filter(Boolean);
}

function temperatura(wartosc: string) {
  const czysta = wartosc.trim();
  if (!czysta || czysta.includes("°")) {
    return czysta;
  }
  return `${czysta}°C`;
}

function cisnienie(wartosc: string) {
  const czysta = wartosc.trim();
  if (!czysta || /bar/i.test(czysta)) {
    return czysta;
  }
  return `${czysta} bar`;
}

function dataZRoku(iso: string) {
  const sformatowana = formatujDateIso(iso);
  return /^\d{2}\.\d{2}\.\d{4}$/.test(sformatowana) ? `${sformatowana} r.` : "";
}

export function widokProtokolu(dane: DaneProtokoluPdf): WidokProtokolu {
  const raport = dane.protokol;
  const status = raport.status.trim();

  return {
    dataPrzegladu: dataZRoku(raport.dataWypelnienia),
    numerProtokolu: raport.numerProtokolu?.trim() || numerProtokoluZDaty(raport.dataWypelnienia, 1),
    podtytul: raport.czynnosci === "awaria" ? "awaria" : "Przegląd okresowy",
    serwisantNazwa: FIRMA.wlasciciel,
    serwisantTelefon: FIRMA.telefon,
    serwisantEmail: FIRMA.email,
    klientNazwa: dane.imieNazwisko.trim(),
    klientLinie: linieAdresu(dane.adres),
    modelKotla: (raport.modelKotla || raport.typKotla || dane.nazwaKotla).trim(),
    numerKotla: (raport.numerKotla || dane.numerKotla || raport.numerSeryjny).trim(),
    mocNominalna: raport.mocNominalna.trim(),
    sterownik: raport.sterownik.trim(),
    zadanaTemperatura: temperatura(raport.zadanaTemperaturaGrzania || raport.grzanie),
    maksTemperatura: temperatura(raport.maksymalnaTemperaturaZasilania),
    status,
    statusAwaria: raport.czynnosci === "awaria" || /error|usterk|awaria|uszkodz/i.test(status),
    szczelnoscGazowa: raport.szczelnoscGazowa === true,
    cisnienieCO: cisnienie(raport.cisnienieCO ?? ""),
    zaworKociol: raport.zaworKociol === true,
    cisnienieNaczynia: cisnienie(raport.cisnienieNaczynia ?? ""),
    czynnosci: [
      { etykieta: "Czyszczenie wymiennika ciepła", wykonano: raport.czyszczenieWymiennika === true },
      { etykieta: "Czyszczenie palnika i elektrod", wykonano: raport.czyszczeniePalnika === true },
      { etykieta: "Sprawdzenie syfonu kondensatu", wykonano: raport.sprawdzenieSyfonu === true },
    ],
    inneCzynnosci: (raport.inneCzynnosci ?? "").trim(),
    dataKolejnegoPrzegladu: dataZRoku(raport.dataKolejnegoPrzegladu ?? ""),
    uwagi: (raport.uwagi ?? "").trim(),
    ...zdjeciaZPodpisami(raport.zdjecia, raport.podpisyZdjec),
    podpisKlienta: (raport.podpisKlienta ?? "").startsWith("data:image/png") ? raport.podpisKlienta ?? "" : "",
    podpisSerwisanta: (raport.podpisSerwisanta ?? "").startsWith("data:image/png") ? raport.podpisSerwisanta ?? "" : "",
  };
}

function zdjeciaZPodpisami(zdjecia: string[] | undefined, podpisy: string[] | undefined) {
  const adresy = (zdjecia ?? []).filter((zdjecie) => zdjecie.startsWith("data:image/")).slice(0, 10);
  return {
    zdjecia: adresy,
    podpisyZdjec: adresy.map((_, indeks) => (podpisy?.[indeks] ?? "").trim()),
  };
}
