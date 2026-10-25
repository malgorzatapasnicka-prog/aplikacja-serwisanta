import { readFileSync } from "node:fs";
import { join } from "node:path";
import { jsPDF } from "jspdf";
import type { DaneProtokoluPdf } from "@/lib/daneProtokolu";
import { widokProtokolu, type WidokProtokolu } from "@/lib/widokProtokolu";

let czcionka: string | null = null;

function czcionkaBase64() {
  if (!czcionka) {
    czcionka = readFileSync(join(process.cwd(), "src/lib/fonts/NotoSans-Regular.ttf")).toString("base64");
  }
  return czcionka;
}

function kratka(zaznaczone: boolean, dopisek = "") {
  const pudelko = zaznaczone ? "[×]" : "[  ]";
  return dopisek ? `${pudelko} ${dopisek}` : pudelko;
}

export function utworzPdfProtokolu(dane: DaneProtokoluPdf) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS("NotoSans-Regular.ttf", czcionkaBase64());
  doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
  doc.setFont("NotoSans", "normal");

  const widok = widokProtokolu(dane);
  const lewy = 20;
  const szerokosc = 170;
  let y = 18;

  function nowaStrona() {
    doc.addPage();
    y = 20;
    doc.setFont("NotoSans", "normal");
  }

  function zapewnij(mm: number) {
    if (y + mm > 277) {
      nowaStrona();
    }
  }

  function tekst(wartosc: string, x: number, yy: number, opcje?: { align?: "left" | "right" | "center"; maxWidth?: number }) {
    doc.text(wartosc, x, yy, opcje);
  }

  function linia(od: number, doX: number, grubosc = 0.4) {
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(grubosc);
    doc.line(od, y, doX, y);
  }

  function kropki(x: number, szer: number) {
    doc.setDrawColor(100, 116, 139);
    doc.setLineDashPattern([0.3, 0.9], 0);
    doc.setLineWidth(0.2);
    doc.line(x, y - 0.6, x + szer, y - 0.6);
    doc.setLineDashPattern([], 0);
  }

  function wartoscAlboKropki(wartosc: string, x: number, szer: number, czerwony = false) {
    if (!wartosc.trim()) {
      kropki(x, szer);
      return;
    }
    doc.setTextColor(czerwony ? 220 : 15, czerwony ? 38 : 23, czerwony ? 38 : 42);
    tekst(wartosc, x, y, { maxWidth: szer });
    doc.setTextColor(15, 23, 42);
  }

  function tabela(
    naglowki: [string, string, string, string],
    wiersze: Array<[string, string, string, string, boolean?]>,
  ) {
    const kolumny = [46, 39, 46, 39];
    zapewnij(12 + wiersze.length * 8);
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    linia(lewy, lewy + szerokosc, 0.45);
    y += 5;
    let x = lewy;
    naglowki.forEach((naglowek, indeks) => {
      tekst(naglowek, x + 1, y);
      x += kolumny[indeks];
    });
    y += 2.2;
    linia(lewy, lewy + szerokosc, 0.25);

    wiersze.forEach((wiersz, indeksWiersza) => {
      if (indeksWiersza % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(lewy, y, szerokosc, 8, "F");
      }
      y += 5.2;
      x = lewy;
      wiersz.slice(0, 4).forEach((komorkaSurowa, indeks) => {
        const komorka = typeof komorkaSurowa === "string" ? komorkaSurowa : "";
        const sasiad = String(wiersz[indeks % 2 === 0 ? indeks + 1 : indeks - 1] ?? "");
        const pustaPara = !komorka.trim() && !sasiad.trim();
        const czerwony = Boolean(wiersz[4]) && indeks === 1;
        if (komorka === "bar") {
          kropki(x + 1, kolumny[indeks] - 12);
          doc.setTextColor(15, 23, 42);
          tekst("bar", x + kolumny[indeks] - 9, y);
        } else if (!pustaPara) {
          wartoscAlboKropki(komorka, x + 1, kolumny[indeks] - 2, czerwony);
        }
        x += kolumny[indeks];
      });
      y += 2.8;
    });
    linia(lewy, lewy + szerokosc, 0.45);
    y += 6;
  }

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  tekst(`Data przeglądu: ${widok.dataPrzegladu || "………………"}`, lewy + szerokosc, y, { align: "right" });
  y += 5;
  tekst(`Nr protokołu: ${widok.numerProtokolu || "………………"}`, lewy + szerokosc, y, { align: "right" });
  y += 4;
  linia(lewy, lewy + szerokosc, 0.6);
  y += 10;
  doc.setFontSize(18);
  tekst("PROTOKÓŁ", lewy + szerokosc / 2, y, { align: "center" });
  y += 7;
  doc.setFontSize(11);
  tekst(widok.podtytul, lewy + szerokosc / 2, y, { align: "center" });
  y += 10;

  const startKolumn = y;
  doc.setFontSize(10);
  tekst("Serwisant", lewy, y);
  y += 5;
  tekst(widok.serwisantNazwa, lewy, y);
  y += 5;
  tekst(`Tel: ${widok.serwisantTelefon}`, lewy, y);
  y += 5;
  tekst(`e-mail:${widok.serwisantEmail}`, lewy, y);

  let yPrawy = startKolumn;
  const prawy = lewy + 90;
  tekst(widok.klientNazwa, prawy, yPrawy);
  widok.klientLinie.forEach((linia) => {
    yPrawy += 5;
    tekst(linia, prawy, yPrawy);
  });
  y = Math.max(y, yPrawy) + 8;

  doc.setFontSize(12);
  tekst("1. Identyfikacja i ustawienia urządzenia", lewy, y);
  y += 4;
  tabela(
    ["Parametr", "Wartość", "Parametr", "Wartość"],
    [
      ["Model kotła", widok.modelKotla, "Numer kotła", widok.numerKotla],
      ["Moc nominalna", widok.mocNominalna, "Typ sterownika", widok.sterownik],
      ["Zadana temp. grzania", widok.zadanaTemperatura, "Maks. temp. zasilania", widok.maksTemperatura],
      ["Status urządzenia", widok.status, "", "", widok.statusAwaria],
    ],
  );

  doc.setFontSize(12);
  tekst("2. Test bezpieczeństwa i szczelności", lewy, y);
  y += 4;
  tabela(
    ["Kryterium kontrolne", "Status", "Parametr", "Wartość"],
    [
      [
        "Szczelność instalacji gazowej",
        kratka(widok.szczelnoscGazowa, "Pozytywny"),
        "Ciśnienie w instalacji C.O.",
        widok.cisnienieCO || "bar",
      ],
      [
        "Zawór - kocioł",
        kratka(widok.zaworKociol),
        "Ciśnienie naczynia wzbiorczego",
        widok.cisnienieNaczynia || "bar",
      ],
    ],
  );

  doc.setFontSize(12);
  tekst("3. Lista kontrolna wykonanych czynności", lewy, y);
  y += 7;
  doc.setFontSize(10);
  for (const pozycja of widok.czynnosci) {
    zapewnij(7);
    tekst(`${kratka(pozycja.wykonano)}  ${pozycja.etykieta}`, lewy, y);
    y += 6;
  }
  zapewnij(12);
  tekst(`${kratka(Boolean(widok.inneCzynnosci))}  Inne: ${widok.inneCzynnosci}`, lewy, y);
  if (!widok.inneCzynnosci) {
    kropki(lewy + 28, 50);
  }
  y += 7;
  tekst("Data kolejnego przeglądu:", lewy, y);
  if (widok.dataKolejnegoPrzegladu) {
    tekst(widok.dataKolejnegoPrzegladu, lewy + 52, y);
  } else {
    kropki(lewy + 52, 40);
  }
  y += 8;

  zapewnij(70);
  doc.setFontSize(12);
  tekst("4. Uwagi serwisanta i zdiagnozowane usterki", lewy, y);
  y += 4;
  const linieUwag = widok.uwagi ? (doc.splitTextToSize(widok.uwagi, szerokosc - 8) as string[]) : [];
  const wysokoscUwag = Math.max(widok.uwagi ? 28 : 48, linieUwag.length * 5 + 8);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.3);
  doc.rect(lewy, y, szerokosc, wysokoscUwag);
  if (linieUwag.length > 0) {
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(linieUwag, lewy + 3, y + 6);
  }
  y += wysokoscUwag + 8;

  zapewnij(50);
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  tekst("5. Analiza spalin", lewy, y);
  y += 4;
  const wysokoscZdjecia = 42;
  doc.rect(lewy, y, szerokosc, wysokoscZdjecia);
  wstawZdjecie(doc, widok, lewy + 3, y + 3, szerokosc - 6, wysokoscZdjecia - 6);
  y += wysokoscZdjecia + 10;

  zapewnij(28);
  const podpisY = Math.max(y + 14, 262);
  if (podpisY > 275) {
    nowaStrona();
  }
  const liniaPodpisu = Math.min(podpisY, 268);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.3);
  doc.line(lewy, liniaPodpisu, lewy + 55, liniaPodpisu);
  doc.line(lewy + szerokosc - 55, liniaPodpisu, lewy + szerokosc, liniaPodpisu);
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  tekst("Podpis klienta", lewy + 27.5, liniaPodpisu + 5, { align: "center" });
  tekst("Podpis i pieczęć serwisanta", lewy + szerokosc - 27.5, liniaPodpisu + 5, { align: "center" });

  return Buffer.from(doc.output("arraybuffer"));
}

function wstawZdjecie(doc: jsPDF, widok: WidokProtokolu, x: number, y: number, szerokosc: number, wysokosc: number) {
  const adres = widok.zdjecia[0];
  if (!adres) {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("Tu system automatycznie wklei zdjęcie z analizatora spalin / aparatu", x + szerokosc / 2, y + wysokosc / 2, {
      align: "center",
      maxWidth: szerokosc - 8,
    });
    doc.setTextColor(15, 23, 42);
    return;
  }

  const format = adres.startsWith("data:image/png") ? "PNG" : "JPEG";
  let rysowanaSzerokosc = szerokosc;
  let rysowanaWysokosc = wysokosc;
  let rysowaneX = x;
  let rysowaneY = y;
  try {
    const wlasciwosci = doc.getImageProperties(adres);
    if (wlasciwosci.width > 0 && wlasciwosci.height > 0) {
      const proporcja = wlasciwosci.width / wlasciwosci.height;
      rysowanaWysokosc = wysokosc;
      rysowanaSzerokosc = wysokosc * proporcja;
      if (rysowanaSzerokosc > szerokosc) {
        rysowanaSzerokosc = szerokosc;
        rysowanaWysokosc = szerokosc / proporcja;
      }
      rysowaneX = x + (szerokosc - rysowanaSzerokosc) / 2;
      rysowaneY = y + (wysokosc - rysowanaWysokosc) / 2;
    }
  } catch {
    rysowanaSzerokosc = szerokosc;
    rysowanaWysokosc = wysokosc;
  }

  doc.addImage(adres, format, rysowaneX, rysowaneY, rysowanaSzerokosc, rysowanaWysokosc, undefined, "FAST");
}
