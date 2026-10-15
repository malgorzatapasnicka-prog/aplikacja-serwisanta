import { readFileSync } from "node:fs";
import { join } from "node:path";
import { jsPDF } from "jspdf";
import { FIRMA } from "@/lib/firma";
import { formatujDateIso, type DaneProtokoluPdf } from "@/lib/daneProtokolu";
import { ETYKIETY_CZYNNOSCI } from "@/types/protokol";

let czcionka: string | null = null;

function czcionkaBase64() {
  if (!czcionka) {
    czcionka = readFileSync(join(process.cwd(), "src/lib/fonts/NotoSans-Regular.ttf")).toString(
      "base64",
    );
  }
  return czcionka;
}

export function utworzPdfProtokolu(dane: DaneProtokoluPdf) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS("NotoSans-Regular.ttf", czcionkaBase64());
  doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
  doc.setFont("NotoSans");

  const raport = dane.protokol;
  const lewy = 16;
  const szerokosc = 178;
  let y = 18;

  function naglowekFirmy() {
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(18);
    doc.text(FIRMA.nazwa, lewy, y);
    y += 7;
    doc.setFontSize(12);
    doc.text(FIRMA.wlasciciel, lewy, y);
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(FIRMA.ulica, lewy, y);
    y += 5;
    doc.text(FIRMA.kod, lewy, y);
    y += 5;
    doc.text(`tel. ${FIRMA.telefon}`, lewy, y);
    y += 6;
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.4);
    doc.line(lewy, y, lewy + szerokosc, y);
    y += 8;
    doc.setTextColor(15, 23, 42);
  }

  function sekcja(tytul: string) {
    if (y > 250) {
      doc.addPage();
      y = 20;
      doc.setFont("NotoSans");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`${FIRMA.nazwa}  ·  ${FIRMA.wlasciciel}`, lewy, 12);
      doc.text(`tel. ${FIRMA.telefon}`, lewy + szerokosc, 12, { align: "right" });
      y = 20;
    }
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(tytul, lewy, y);
    y += 2;
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.3);
    doc.line(lewy, y, lewy + szerokosc, y);
    y += 6;
  }

  function wiersz(etykieta: string, wartosc: string) {
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(etykieta, lewy, y);
    doc.setTextColor(15, 23, 42);
    const linie = doc.splitTextToSize(wartosc.trim() || "—", 110) as string[];
    doc.text(linie, lewy + 62, y);
    y += Math.max(6, linie.length * 5);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.15);
    doc.line(lewy, y - 2, lewy + szerokosc, y - 2);
  }

  naglowekFirmy();
  doc.setFontSize(16);
  doc.text("Protokół serwisowy", lewy, y);
  y += 7;
  doc.setFontSize(12);
  doc.text(raport.nazwaRaportu || "—", lewy, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Data wypełnienia: ${formatujDateIso(raport.dataWypelnienia)}    ${ETYKIETY_CZYNNOSCI[raport.czynnosci]}`,
    lewy,
    y,
  );
  y += 4;

  const kociol = [dane.numerKotla, dane.nazwaKotla].filter((wartosc) => wartosc.trim()).join(" · ");
  sekcja("Dane klienta");
  wiersz("Imię i nazwisko", dane.imieNazwisko);
  wiersz("Adres", dane.adres);
  wiersz("Numer kotła", kociol || dane.numerKotla);

  sekcja("Przeprowadzone czynności");
  wiersz("Rodzaj", ETYKIETY_CZYNNOSCI[raport.czynnosci]);

  sekcja("Dane urządzenia");
  wiersz("Status", raport.status);
  wiersz("Typ kotła", raport.typKotla);
  wiersz("Moc nominalna kotła", raport.mocNominalna);
  wiersz("Sterownik", raport.sterownik);
  wiersz("Nr seryjny", raport.numerSeryjny);

  sekcja("Ustawienia urządzenia");
  wiersz("Grzanie", raport.grzanie);
  wiersz("Maksymalna temperatura zasilania", raport.maksymalnaTemperaturaZasilania);

  y += 12;
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Podpis serwisanta", lewy, y);
  doc.text("Data wypełnienia", lewy + 110, y);
  y += 12;
  doc.setDrawColor(203, 213, 225);
  doc.line(lewy, y, lewy + 70, y);
  doc.line(lewy + 110, y, lewy + 160, y);
  y += 5;
  doc.setTextColor(15, 23, 42);
  doc.text(FIRMA.wlasciciel, lewy, y);
  doc.text(formatujDateIso(raport.dataWypelnienia), lewy + 110, y);

  const strony = doc.getNumberOfPages();
  for (let numer = 1; numer <= strony; numer += 1) {
    doc.setPage(numer);
    doc.setFont("NotoSans");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${FIRMA.ulica}, ${FIRMA.kod}`, lewy, 290);
    doc.text(String(numer), lewy + szerokosc, 290, { align: "right" });
    if (numer > 1) {
      doc.setTextColor(15, 23, 42);
      doc.text(`${FIRMA.nazwa}  ·  ${FIRMA.wlasciciel}`, lewy, 12);
      doc.setTextColor(100, 116, 139);
      doc.text(`tel. ${FIRMA.telefon}`, lewy + szerokosc, 12, { align: "right" });
    }
  }

  return Buffer.from(doc.output("arraybuffer"));
}
