import { formatujDateIso } from "@/lib/daneProtokolu";
import { FIRMA } from "@/lib/firma";

/** Ile dni po 9. miesiącu wolno ponowić wysyłkę, gdy pierwsza próba się nie uda. */
export const DNI_OKNA_WYSYLKI = 14;

export type DecyzjaPrzypomnienia =
  | { wyslac: true; dataPrzegladu: string; terminPrzegladu: string }
  | { wyslac: false; powod: "brak-daty" | "za-wczesnie" | "po-oknie" | "juz-wyslane" };

function pad(liczba: number) {
  return String(liczba).padStart(2, "0");
}

/** Zostawia samą datę YYYY-MM-DD i odrzuca daty kalendarzowe, których nie ma (np. 31 lutego). */
export function znormalizujDate(wartosc: string): string | null {
  const ucieta = wartosc.trim().slice(0, 10);
  const dopasowanie = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ucieta);
  if (!dopasowanie) {
    return null;
  }

  const rok = Number(dopasowanie[1]);
  const miesiac = Number(dopasowanie[2]);
  const dzien = Number(dopasowanie[3]);
  if (miesiac < 1 || miesiac > 12 || dzien < 1) {
    return null;
  }

  const data = new Date(Date.UTC(rok, miesiac - 1, dzien));
  if (data.getUTCFullYear() !== rok || data.getUTCMonth() !== miesiac - 1 || data.getUTCDate() !== dzien) {
    return null;
  }

  return ucieta;
}

export function dodajMiesiaceIso(iso: string, miesiace: number): string | null {
  const data = znormalizujDate(iso);
  if (!data) {
    return null;
  }

  const rok = Number(data.slice(0, 4));
  const miesiac = Number(data.slice(5, 7));
  const dzien = Number(data.slice(8, 10));
  const pierwszyDniaMiesiaca = new Date(Date.UTC(rok, miesiac - 1 + miesiace, 1));
  const ostatniDzien = new Date(
    Date.UTC(pierwszyDniaMiesiaca.getUTCFullYear(), pierwszyDniaMiesiaca.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const wynik = new Date(
    Date.UTC(pierwszyDniaMiesiaca.getUTCFullYear(), pierwszyDniaMiesiaca.getUTCMonth(), Math.min(dzien, ostatniDzien)),
  );

  return `${wynik.getUTCFullYear()}-${pad(wynik.getUTCMonth() + 1)}-${pad(wynik.getUTCDate())}`;
}

export function dodajDniIso(iso: string, dni: number): string | null {
  const data = znormalizujDate(iso);
  if (!data) {
    return null;
  }

  const wynik = new Date(Date.UTC(Number(data.slice(0, 4)), Number(data.slice(5, 7)) - 1, Number(data.slice(8, 10)) + dni));
  return `${wynik.getUTCFullYear()}-${pad(wynik.getUTCMonth() + 1)}-${pad(wynik.getUTCDate())}`;
}

/** Dzisiejsza data kalendarzowa w Polsce, jako YYYY-MM-DD. */
export function dzisWWarszawie(teraz = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(teraz);
}

/**
 * SMS wychodzi raz, gdy od daty przeglądu minęło 9 miesięcy
 * (zostały 3 miesiące do rocznego terminu). Przez kolejne 14 dni
 * system ponawia próbę, jeśli wcześniejsza wysyłka się nie zapisała.
 */
export function czyPoraNaPrzypomnienie(
  dataPrzegladu: string,
  dzisiaj: string,
  wyslaneDlaDaty = "",
): DecyzjaPrzypomnienia {
  const data = znormalizujDate(dataPrzegladu);
  const dzien = znormalizujDate(dzisiaj);
  if (!data || !dzien) {
    return { wyslac: false, powod: "brak-daty" };
  }

  if (znormalizujDate(wyslaneDlaDaty) === data) {
    return { wyslac: false, powod: "juz-wyslane" };
  }

  const start = dodajMiesiaceIso(data, 9);
  const termin = dodajMiesiaceIso(data, 12);
  const koniecOkna = start ? dodajDniIso(start, DNI_OKNA_WYSYLKI) : null;
  if (!start || !termin || !koniecOkna) {
    return { wyslac: false, powod: "brak-daty" };
  }

  if (dzien < start) {
    return { wyslac: false, powod: "za-wczesnie" };
  }

  if (dzien >= koniecOkna) {
    return { wyslac: false, powod: "po-oknie" };
  }

  return { wyslac: true, dataPrzegladu: data, terminPrzegladu: termin };
}

/** Numer w formacie SMSAPI: 48 i 9 cyfr. */
export function numerDoSms(telefon: string): string | null {
  let cyfry = telefon.replace(/\D/g, "");
  if (cyfry.startsWith("00")) {
    cyfry = cyfry.slice(2);
  }
  if (cyfry.length === 9) {
    cyfry = `48${cyfry}`;
  }
  if (cyfry.length === 11 && cyfry.startsWith("48")) {
    return cyfry;
  }
  return null;
}

export function trescPrzypomnienia(terminPrzegladu: string): string {
  const telefon = FIRMA.telefon.replace(/^\+48\s*/, "").trim();
  return `${FIRMA.nazwa}: za 3 miesiące (do ${formatujDateIso(terminPrzegladu)}) mija termin przeglądu. Prosimy o telefon ${telefon}.`;
}
