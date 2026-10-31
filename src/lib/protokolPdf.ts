import { readFileSync } from "node:fs";
import { join } from "node:path";
import { jsPDF } from "jspdf";
import type { DaneProtokoluPdf } from "@/lib/daneProtokolu";
import { widokProtokolu } from "@/lib/widokProtokolu";
import type { WynikKontroli } from "@/types/protokol";

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

function statusWyniku(wynik: WynikKontroli) {
  return [
    kratka(wynik === "pozytywny", "Pozytywny"),
    kratka(wynik === "negatywny", "Negatywny"),
    kratka(wynik === "nie_dotyczy", "Nie dotyczy"),
  ].join("\n");
}

function wartoscLubNieDotyczy(nieDotyczy: boolean, wartosc: string, pusta: string) {
  if (nieDotyczy) {
    return "Nie dotyczy";
  }
  return wartosc.trim() || pusta;
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
      const komorki = wiersz.slice(0, 4).map((komorkaSurowa, indeks) => {
        const komorka = typeof komorkaSurowa === "string" ? komorkaSurowa : "";
        const sasiad = String(wiersz[indeks % 2 === 0 ? indeks + 1 : indeks - 1] ?? "");
        const pustaPara = !komorka.trim() && !sasiad.trim();
        const szer = kolumny[indeks] - 2;
        const linie =
          !pustaPara && komorka !== "bar" && komorka.trim()
            ? (doc.splitTextToSize(komorka, szer) as string[])
            : [];
        return {
          komorka,
          pustaPara,
          szer,
          linie,
          czerwony: Boolean(wiersz[4]) && indeks === 1,
        };
      });
      const maxLinii = Math.max(1, ...komorki.map((komorka) => komorka.linie.length));
      const wysokosc = Math.max(8, 3.4 + maxLinii * 4);
      zapewnij(wysokosc + 2);
      if (indeksWiersza % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(lewy, y, szerokosc, wysokosc, "F");
      }
      const baseline = y + 4.4;
      let xKomorki = lewy;
      komorki.forEach((komorka, indeks) => {
        if (komorka.komorka === "bar") {
          doc.setDrawColor(100, 116, 139);
          doc.setLineDashPattern([0.3, 0.9], 0);
          doc.setLineWidth(0.2);
          doc.line(xKomorki + 1, baseline - 0.6, xKomorki + kolumny[indeks] - 11, baseline - 0.6);
          doc.setLineDashPattern([], 0);
          doc.setTextColor(15, 23, 42);
          tekst("bar", xKomorki + kolumny[indeks] - 9, baseline);
        } else if (komorka.linie.length > 0) {
          doc.setTextColor(komorka.czerwony ? 220 : 15, komorka.czerwony ? 38 : 23, komorka.czerwony ? 38 : 42);
          doc.text(komorka.linie, xKomorki + 1, baseline);
          doc.setTextColor(15, 23, 42);
        } else if (!komorka.pustaPara) {
          doc.setDrawColor(100, 116, 139);
          doc.setLineDashPattern([0.3, 0.9], 0);
          doc.setLineWidth(0.2);
          doc.line(xKomorki + 1, baseline - 0.6, xKomorki + 1 + komorka.szer, baseline - 0.6);
          doc.setLineDashPattern([], 0);
        }
        xKomorki += kolumny[indeks];
      });
      y += wysokosc;
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
  tekst(`e-mail: ${widok.serwisantEmail}`, lewy, y);

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
  tabela(["Parametr", "Wartość", "Parametr", "Wartość"], [
    ["Model kotła", widok.modelKotla, "Numer kotła", widok.numerKotla],
    ["Moc nominalna", widok.mocNominalna, "Typ sterownika", widok.sterownik],
    ["Zadana temp. grzania", widok.zadanaTemperatura, "Maks. temp. zasilania", widok.maksTemperatura],
    ["Status urządzenia", widok.status, "", "", widok.statusAwaria],
  ]);

  if (widok.dodatkoweUrzadzenie.length > 0 || widok.opisUslugi) {
    zapewnij(10);
    doc.setFontSize(12);
    tekst("Urządzenie", lewy, y);
    y += 6;
    doc.setFontSize(10);
    for (const [etykieta, wartosc] of widok.dodatkoweUrzadzenie) {
      const linie = doc.splitTextToSize(`${etykieta}: ${wartosc}`, szerokosc) as string[];
      zapewnij(linie.length * 5);
      doc.text(linie, lewy, y);
      y += linie.length * 5;
    }
    if (widok.opisUslugi) {
      const linie = doc.splitTextToSize(widok.opisUslugi, szerokosc) as string[];
      zapewnij(linie.length * 5 + 2);
      doc.text(linie, lewy, y);
      y += linie.length * 5 + 2;
    }
    y += 4;
  }

  doc.setFontSize(12);
  tekst("2. Test bezpieczeństwa i szczelności", lewy, y);
  y += 4;
  tabela(["Kryterium kontrolne", "Status", "Parametr", "Wartość"], [
    [
      "Szczelność instalacji gazowej (zawór-kocioł)",
      statusWyniku(widok.wynikSzczelnosci),
      "Ciśnienie w instalacji C.O.",
      wartoscLubNieDotyczy(widok.cisnienieCONieDotyczy, widok.cisnienieCO, "bar"),
    ],
    [
      "Test łańcucha zabezpieczeń",
      statusWyniku(widok.wynikLancucha),
      "Ciśnienie wstępne w naczyniu wzbiorczym",
      wartoscLubNieDotyczy(widok.cisnienieNaczyniaNieDotyczy, widok.cisnienieNaczynia, "bar"),
    ],
  ]);

  if (widok.pomiary.length > 0) {
    zapewnij(10);
    doc.setFontSize(12);
    tekst("Pomiary", lewy, y);
    y += 6;
    doc.setFontSize(10);
    for (const [etykieta, wartosc] of widok.pomiary) {
      zapewnij(6);
      tekst(`${etykieta}: ${wartosc}`, lewy, y);
      y += 5;
    }
    y += 3;
  }

  doc.setFontSize(12);
  tekst("3. Lista kontrolna wykonanych czynności", lewy, y);
  y += 7;
  doc.setFontSize(10);
  for (const pozycja of widok.czynnosci) {
    zapewnij(7);
    tekst(
      `${kratka(pozycja.stan === "wykonano")}  ${pozycja.etykieta}    ${kratka(pozycja.stan === "nie_dotyczy", "Nie dotyczy")}`,
      lewy,
      y,
    );
    y += 6;
  }
  zapewnij(12);
  tekst(
    `${kratka(!widok.inneNieDotyczy && Boolean(widok.inneCzynnosci))}  Inne: ${widok.inneNieDotyczy ? "" : widok.inneCzynnosci}    ${kratka(widok.inneNieDotyczy, "Nie dotyczy")}`,
    lewy,
    y,
  );
  if (!widok.inneNieDotyczy && !widok.inneCzynnosci) {
    kropki(lewy + 28, 50);
  }
  y += 7;
  tekst("Data kolejnego przeglądu:", lewy, y);
  if (widok.kolejnyPrzegladNieDotyczy) {
    tekst("Nie dotyczy", lewy + 52, y);
  } else if (widok.dataKolejnegoPrzegladu) {
    tekst(widok.dataKolejnegoPrzegladu, lewy + 52, y);
  } else {
    kropki(lewy + 52, 40);
  }
  y += 8;

  if (widok.checklista.length > 0) {
    zapewnij(10);
    doc.setFontSize(12);
    tekst("Checklista czynności serwisowych", lewy, y);
    y += 6;
    for (const grupa of widok.checklista) {
      zapewnij(8);
      doc.setFontSize(11);
      tekst(grupa.tytul, lewy, y);
      y += 5;
      doc.setFontSize(10);
      for (const pozycja of grupa.pozycje) {
        const linie = doc.splitTextToSize(`${pozycja.etykieta}: ${pozycja.stan}`, szerokosc - 4) as string[];
        zapewnij(linie.length * 5);
        doc.text(linie, lewy + 2, y);
        y += linie.length * 5;
      }
    }
    y += 3;
  }

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

  if (widok.rozliczenie.length > 0) {
    zapewnij(12 + widok.rozliczenie.length * 6);
    doc.setFontSize(12);
    tekst("Rozliczenie", lewy, y);
    y += 6;
    doc.setFontSize(10);
    tekst("Netto", lewy + 110, y);
    tekst("Brutto", lewy + 145, y);
    y += 5;
    for (const wiersz of widok.rozliczenie) {
      zapewnij(6);
      tekst(wiersz.nazwa, lewy, y);
      tekst(wiersz.netto || "—", lewy + 110, y);
      tekst(wiersz.brutto || "—", lewy + 145, y);
      y += 5;
    }
    y += 4;
  }

  zapewnij(50);
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  tekst("5. Załączniki", lewy, y);
  y += 6;
  const zdjecia = widok.zdjecia.slice(0, 10);
  if (zdjecia.length === 0) {
    y += 4;
  } else if (zdjecia.length === 1) {
      const wysokoscZdjecia = 78;
      zapewnij(wysokoscZdjecia + 16);
      const szerokoscZdjecia = 130;
      const x = lewy + (szerokosc - szerokoscZdjecia) / 2;
      wstawZdjecie(doc, zdjecia[0], x, y, szerokoscZdjecia, wysokoscZdjecia);
      y += wysokoscZdjecia + 4;
      y = dopiszPodpis(doc, widok.podpisyZdjec[0], x, y, szerokoscZdjecia);
      y += 6;
    } else {
      const szerokoscKolumny = 80;
      const odstep = 10;
      const wysokoscZdjecia = 68;
      for (let indeks = 0; indeks < zdjecia.length; indeks += 2) {
        const praweJest = indeks + 1 < zdjecia.length;
        const podpisLewy = widok.podpisyZdjec[indeks]?.trim() ?? "";
        const podpisPrawy = praweJest ? (widok.podpisyZdjec[indeks + 1]?.trim() ?? "") : "";
        const dodatkowyOpis = Math.max(wysokoscPodpisu(doc, podpisLewy, szerokoscKolumny), wysokoscPodpisu(doc, podpisPrawy, szerokoscKolumny));
        zapewnij(wysokoscZdjecia + dodatkowyOpis + 8);
        const start = y;
        wstawZdjecie(doc, zdjecia[indeks], lewy, start, szerokoscKolumny, wysokoscZdjecia);
        if (praweJest) {
          wstawZdjecie(doc, zdjecia[indeks + 1], lewy + szerokoscKolumny + odstep, start, szerokoscKolumny, wysokoscZdjecia);
        }
        const yPodpisu = start + wysokoscZdjecia + 4;
        dopiszPodpis(doc, podpisLewy, lewy, yPodpisu, szerokoscKolumny);
        if (praweJest) {
          dopiszPodpis(doc, podpisPrawy, lewy + szerokoscKolumny + odstep, yPodpisu, szerokoscKolumny);
        }
        y = yPodpisu + dodatkowyOpis + 4;
      }
  }

  if (widok.oswiadczeniePowierzchni) {
    const tresc =
      "Oświadczam, że powierzchnia użytkowa budynku mieszkalnego jednorodzinnego nie przekracza 300 mkw.";
    const linie = doc.splitTextToSize(tresc, szerokosc) as string[];
    zapewnij(linie.length * 5 + 10);
    doc.setFontSize(12);
    tekst("Oświadczenie", lewy, y);
    y += 6;
    doc.setFontSize(10);
    doc.text(linie, lewy, y);
    y += linie.length * 5 + 4;
  }

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
  if (widok.podpisKlienta.startsWith("data:image/png")) {
    try {
      const poleSzerokosc = 50;
      const poleWysokosc = 14;
      let szerokoscPodpisu = poleSzerokosc;
      let wysokoscPodpisu = poleWysokosc;
      const wlasciwosci = doc.getImageProperties(widok.podpisKlienta);
      if (wlasciwosci.width > 0 && wlasciwosci.height > 0) {
        const proporcja = wlasciwosci.width / wlasciwosci.height;
        szerokoscPodpisu = poleWysokosc * proporcja;
        wysokoscPodpisu = poleWysokosc;
        if (szerokoscPodpisu > poleSzerokosc) {
          szerokoscPodpisu = poleSzerokosc;
          wysokoscPodpisu = poleSzerokosc / proporcja;
        }
      }
      doc.addImage(
        widok.podpisKlienta,
        "PNG",
        lewy + (55 - szerokoscPodpisu) / 2,
        liniaPodpisu - wysokoscPodpisu - 0.8,
        szerokoscPodpisu,
        wysokoscPodpisu,
      );
    } catch {
      // Kreska zostaje pusta, gdy obrazu podpisu nie da się odczytać.
    }
  }
  if (widok.podpisSerwisanta.startsWith("data:image/png")) {
    try {
      const poleSzerokosc = 50;
      const poleWysokosc = 14;
      let szerokoscPodpisu = poleSzerokosc;
      let wysokoscPodpisu = poleWysokosc;
      const wlasciwosci = doc.getImageProperties(widok.podpisSerwisanta);
      if (wlasciwosci.width > 0 && wlasciwosci.height > 0) {
        const proporcja = wlasciwosci.width / wlasciwosci.height;
        szerokoscPodpisu = poleWysokosc * proporcja;
        wysokoscPodpisu = poleWysokosc;
        if (szerokoscPodpisu > poleSzerokosc) {
          szerokoscPodpisu = poleSzerokosc;
          wysokoscPodpisu = poleSzerokosc / proporcja;
        }
      }
      doc.addImage(
        widok.podpisSerwisanta,
        "PNG",
        lewy + szerokosc - 55 + (55 - szerokoscPodpisu) / 2,
        liniaPodpisu - wysokoscPodpisu - 0.8,
        szerokoscPodpisu,
        wysokoscPodpisu,
      );
    } catch {
      // Kreska zostaje pusta, gdy obrazu podpisu nie da się odczytać.
    }
  }
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  tekst("Podpis klienta", lewy + 27.5, liniaPodpisu + 5, { align: "center" });
  tekst("Podpis i pieczęć serwisanta", lewy + szerokosc - 27.5, liniaPodpisu + 5, { align: "center" });

  return Buffer.from(doc.output("arraybuffer"));
}

function wysokoscPodpisu(doc: jsPDF, podpis: string, szerokosc: number) {
  const czysty = podpis.trim();
  if (!czysty) {
    return 0;
  }
  const linie = doc.splitTextToSize(czysty, szerokosc) as string[];
  return 4 + linie.length * 3.6;
}

function dopiszPodpis(doc: jsPDF, podpis: string | undefined, x: number, y: number, szerokosc: number) {
  const czysty = podpis?.trim() ?? "";
  if (!czysty) {
    return y;
  }
  doc.setFont("NotoSans", "normal");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  const linie = doc.splitTextToSize(czysty, szerokosc) as string[];
  doc.text(linie, x, y);
  return y + linie.length * 3.6;
}

function wstawZdjecie(doc: jsPDF, adres: string, x: number, y: number, szerokosc: number, wysokosc: number) {
  if (!adres) {
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
