import { formatujDateIso, type DaneProtokoluPdf } from "@/lib/daneProtokolu";
import { FIRMA } from "@/lib/firma";
import { stanCzynnosci, wynikKontroli, type StanCzynnosci, type WynikKontroli } from "@/types/protokol";

export type PozycjaListy = {
  etykieta: string;
  stan: StanCzynnosci;
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
  wynikSzczelnosci: WynikKontroli;
  cisnienieCO: string;
  cisnienieCONieDotyczy: boolean;
  wynikLancucha: WynikKontroli;
  cisnienieNaczynia: string;
  cisnienieNaczyniaNieDotyczy: boolean;
  czynnosci: PozycjaListy[];
  inneCzynnosci: string;
  inneNieDotyczy: boolean;
  dataKolejnegoPrzegladu: string;
  kolejnyPrzegladNieDotyczy: boolean;
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

function zapisanePole(zapisane: string | undefined, zapas = "") {
  if (typeof zapisane === "string") {
    return zapisane.trim();
  }
  return zapas.trim();
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
    modelKotla: zapisanePole(raport.modelKotla ?? raport.typKotla, dane.nazwaKotla),
    numerKotla: zapisanePole(raport.numerKotla ?? raport.numerSeryjny, dane.numerKotla),
    mocNominalna: raport.mocNominalna.trim(),
    sterownik: raport.sterownik.trim(),
    zadanaTemperatura: temperatura(raport.zadanaTemperaturaGrzania || raport.grzanie),
    maksTemperatura: temperatura(raport.maksymalnaTemperaturaZasilania),
    status,
    statusAwaria: raport.czynnosci === "awaria" || /error|usterk|awaria|uszkodz/i.test(status),
    wynikSzczelnosci: wynikKontroli(
      raport.wynikSzczelnosci,
      raport.szczelnoscGazowa === true || raport.zaworKociol === true,
    ),
    cisnienieCO: cisnienie(raport.cisnienieCO ?? ""),
    cisnienieCONieDotyczy: raport.cisnienieCONieDotyczy === true,
    wynikLancucha: wynikKontroli(raport.wynikLancucha),
    cisnienieNaczynia: cisnienie(raport.cisnienieNaczynia ?? ""),
    cisnienieNaczyniaNieDotyczy: raport.cisnienieNaczyniaNieDotyczy === true,
    czynnosci: [
      { etykieta: "Czyszczenie wymiennika ciepła", stan: stanCzynnosci(raport.czyszczenieWymiennika) },
      { etykieta: "Czyszczenie palnika i elektrod", stan: stanCzynnosci(raport.czyszczeniePalnika) },
      { etykieta: "Sprawdzenie syfonu kondensatu", stan: stanCzynnosci(raport.sprawdzenieSyfonu) },
    ],
    inneCzynnosci: (raport.inneCzynnosci ?? "").trim(),
    inneNieDotyczy: raport.inneNieDotyczy === true,
    dataKolejnegoPrzegladu: dataZRoku(raport.dataKolejnegoPrzegladu ?? ""),
    kolejnyPrzegladNieDotyczy: raport.kolejnyPrzegladNieDotyczy === true,
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
