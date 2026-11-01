import {
  LOGO_FIRMY_PNG_BASE64,
  LOGO_FIRMY_SZEROKOSC_PX,
  LOGO_FIRMY_WYSOKOSC_PX,
} from "@/lib/logoFirmy";

/**
 * IDENTYFIKACJA WIZUALNA PDF-ów (protokoły)
 * ------------------------------------------------------------------
 * Tu zmieniasz wygląd nagłówka i kolory dokumentu. Reszta kodu bierze stąd dane.
 */

// 1) KOLOR FIRMOWY (HEX, np. "#003366" granatowy albo "#000080" ciemnoniebieski).
//    Używany jako tło nagłówków tabel (z białym tekstem), dla tytułów sekcji, linii
//    oddzielających, ramki uwag i stopki. Zmień na kod HEX swojej firmy.
export const KOLOR_FIRMOWY = "#003366";

// Jak mocno kolor firmowy wypełnia jasne tło (pasek z datą i numerem protokołu) (0-1).
// 0.1 = bardzo jasny odcień, dzięki czemu ciemny tekst jest dobrze czytelny.
export const UDZIAL_KOLORU_W_TLE = 0.1;

// Efekt „zebry” w tabelach: co drugi wiersz ma to bardzo delikatne, jasnoszare tło.
export const KOLOR_ZEBRY = "#F5F5F5";

// 2) LOGO. Wybierana jest pierwsza niepusta opcja, a gdy żadna nie działa, używane jest
//    logo wbudowane w aplikację (src/lib/logoFirmy.ts).
//
//    >>> TUTAJ WKLEJ LOGO W BASE64 <<<
//    Może to być cały adres "data:image/png;base64,iVBORw0KGgo..." albo sama treść
//    base64. Obsługiwane formaty: PNG i JPEG (SVG nie jest obsługiwany w PDF).
export const LOGO_BASE64 = "";

//    >>> ALBO WKLEJ TUTAJ ADRES URL LOGO <<<
//    Np. "https://twojastrona.pl/logo.png" (PNG lub JPEG, do 2 MB). Adres jest pobierany
//    przez serwer przy tworzeniu PDF-a, więc musi być publicznie dostępny.
export const LOGO_URL = "";

// 3) NAGŁÓWEK: obok logo drukowane są tylko imię i nazwisko oraz dane teleadresowe
//    z src/lib/firma.ts (bez nazwy firmy).

// 4) STOPKA na dole każdej strony (wyśrodkowana, w kolorze firmowym).
export const TEKST_STOPKI = "Radwin Wiński Arkadiusz tel. 785-221-412";

// ------------------------------------------------------------------
// Poniżej logika, zwykle nie trzeba jej zmieniać.
// ------------------------------------------------------------------

const DOMYSLNY_KOLOR = "#0056b3";
const LIMIT_LOGO_BAJTY = 2 * 1024 * 1024;
const CZAS_PAMIECI_LOGO_MS = 10 * 60 * 1000;

export type LogoPdf = {
  dane: Buffer;
  format: "PNG" | "JPEG";
  rozszerzenie: "png" | "jpg";
  szerokoscPx: number;
  wysokoscPx: number;
  proporcje: number;
  dataUrl: string;
};

function znormalizowanyKolor(wartosc: string) {
  const czysty = wartosc.trim().replace(/^#/, "");
  const pelny = /^[0-9a-f]{3}$/i.test(czysty)
    ? czysty
        .split("")
        .map((znak) => znak + znak)
        .join("")
    : czysty;
  return /^[0-9a-f]{6}$/i.test(pelny) ? pelny.toUpperCase() : DOMYSLNY_KOLOR.slice(1).toUpperCase();
}

/** Kolor firmowy jako "RRGGBB" (wielkie litery, bez #), np. dla LaTeX-a. */
export function kolorFirmowyHex() {
  return znormalizowanyKolor(KOLOR_FIRMOWY);
}

export function kolorFirmowyRgb(): [number, number, number] {
  const hex = kolorFirmowyHex();
  return [0, 2, 4].map((poczatek) => parseInt(hex.slice(poczatek, poczatek + 2), 16)) as [number, number, number];
}

/** Kolor „zebry” jako "RRGGBB" (wielkie litery, bez #), np. dla LaTeX-a. */
export function kolorZebryHex() {
  return znormalizowanyKolor(KOLOR_ZEBRY);
}

export function kolorZebryRgb(): [number, number, number] {
  const hex = kolorZebryHex();
  return [0, 2, 4].map((poczatek) => parseInt(hex.slice(poczatek, poczatek + 2), 16)) as [number, number, number];
}

/** Bardzo jasny wariant koloru firmowego (kolor zmieszany z bielą). */
export function kolorFirmowyJasnyRgb(udzial = UDZIAL_KOLORU_W_TLE): [number, number, number] {
  return kolorFirmowyRgb().map((skladowa) => Math.round(255 - (255 - skladowa) * udzial)) as [number, number, number];
}

function wymiaryPng(bajty: Buffer) {
  if (bajty.length < 24 || bajty.readUInt32BE(0) !== 0x89504e47) {
    return null;
  }
  return { szerokosc: bajty.readUInt32BE(16), wysokosc: bajty.readUInt32BE(20) };
}

function wymiaryJpeg(bajty: Buffer) {
  if (bajty.length < 4 || bajty[0] !== 0xff || bajty[1] !== 0xd8) {
    return null;
  }
  let indeks = 2;
  while (indeks + 9 < bajty.length) {
    if (bajty[indeks] !== 0xff) {
      indeks += 1;
      continue;
    }
    const znacznik = bajty[indeks + 1];
    if (znacznik === 0xd8 || znacznik === 0x01 || (znacznik >= 0xd0 && znacznik <= 0xd7)) {
      indeks += 2;
      continue;
    }
    if (znacznik >= 0xc0 && znacznik <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(znacznik)) {
      return { szerokosc: bajty.readUInt16BE(indeks + 7), wysokosc: bajty.readUInt16BE(indeks + 5) };
    }
    indeks += 2 + bajty.readUInt16BE(indeks + 2);
  }
  return null;
}

/** Zamienia bajty obrazu na logo gotowe do PDF-a albo zwraca null (zły format / uszkodzony plik). */
function logoZBajtow(bajty: Buffer): LogoPdf | null {
  const png = wymiaryPng(bajty);
  const jpeg = png ? null : wymiaryJpeg(bajty);
  const wymiary = png ?? jpeg;
  if (!wymiary || wymiary.szerokosc < 1 || wymiary.wysokosc < 1) {
    return null;
  }
  const format = png ? "PNG" : "JPEG";
  return {
    dane: bajty,
    format,
    rozszerzenie: png ? "png" : "jpg",
    szerokoscPx: wymiary.szerokosc,
    wysokoscPx: wymiary.wysokosc,
    proporcje: wymiary.szerokosc / wymiary.wysokosc,
    dataUrl: `data:image/${png ? "png" : "jpeg"};base64,${bajty.toString("base64")}`,
  };
}

function logoZBase64(wartosc: string) {
  const czysta = wartosc.trim().replace(/^data:[^,]*,/i, "").replace(/\s+/g, "");
  if (!czysta || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(czysta)) {
    return null;
  }
  try {
    return logoZBajtow(Buffer.from(czysta, "base64"));
  } catch {
    return null;
  }
}

/** Logo wbudowane w aplikację (src/lib/logoFirmy.ts). */
export function logoWbudowane(): LogoPdf {
  const bajty = Buffer.from(LOGO_FIRMY_PNG_BASE64, "base64");
  return (
    logoZBajtow(bajty) ?? {
      dane: bajty,
      format: "PNG",
      rozszerzenie: "png",
      szerokoscPx: LOGO_FIRMY_SZEROKOSC_PX,
      wysokoscPx: LOGO_FIRMY_WYSOKOSC_PX,
      proporcje: LOGO_FIRMY_SZEROKOSC_PX / LOGO_FIRMY_WYSOKOSC_PX,
      dataUrl: `data:image/png;base64,${LOGO_FIRMY_PNG_BASE64}`,
    }
  );
}

async function logoZUrl(adres: string) {
  let url: URL;
  try {
    url = new URL(adres.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null;
  }
  try {
    const odpowiedz = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!odpowiedz.ok) {
      return null;
    }
    const bajty = Buffer.from(await odpowiedz.arrayBuffer());
    return bajty.length > 0 && bajty.length <= LIMIT_LOGO_BAJTY ? logoZBajtow(bajty) : null;
  } catch {
    return null;
  }
}

let pamiec: { klucz: string; logo: LogoPdf; czas: number } | null = null;

/**
 * Wczytuje logo do PDF-a: LOGO_BASE64, potem LOGO_URL, a w ostateczności logo wbudowane.
 * Błąd w jednym ze źródeł nie przerywa tworzenia PDF-a, tylko przechodzi do następnego.
 */
export async function wczytajLogo(): Promise<LogoPdf> {
  const klucz = `${LOGO_BASE64.length}:${LOGO_BASE64.slice(0, 40)}|${LOGO_URL}`;
  if (pamiec && pamiec.klucz === klucz && Date.now() - pamiec.czas < CZAS_PAMIECI_LOGO_MS) {
    return pamiec.logo;
  }

  const logo =
    (LOGO_BASE64.trim() ? logoZBase64(LOGO_BASE64) : null) ??
    (LOGO_URL.trim() ? await logoZUrl(LOGO_URL) : null) ??
    logoWbudowane();
  pamiec = { klucz, logo, czas: Date.now() };
  return logo;
}
