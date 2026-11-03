import { formatujIlosc, formatujKwoteZl, sumaWGroszach, wartoscWGroszach, type CzescMagazynowa } from "@/lib/magazyn";

const KOLOR_NAGLOWKA: [number, number, number] = [0, 51, 102];
const KOLOR_ZEBRY: [number, number, number] = [245, 245, 245];
const LEWY = 15;
const DOLNY_MARGINES = 282;

const KOLUMNY = [
  { tytul: "Nazwa", szerokosc: 50, wyrownanie: "left" },
  { tytul: "Kod", szerokosc: 26, wyrownanie: "left" },
  { tytul: "Producent", szerokosc: 26, wyrownanie: "left" },
  { tytul: "Ilość", szerokosc: 22, wyrownanie: "right" },
  { tytul: "Cena netto", szerokosc: 26, wyrownanie: "right" },
  { tytul: "Wartość razem", szerokosc: 30, wyrownanie: "right" },
] as const;

const SZEROKOSC_TABELI = KOLUMNY.reduce((suma, kolumna) => suma + kolumna.szerokosc, 0);

/** Spacja zamiast twardej spacji z formatowania liczb, żeby czcionka na pewno miała znak. */
function liczbowy(tekst: string) {
  return tekst.replace(/\u00a0|\u202f/g, " ");
}

/**
 * Tworzy PDF remanentu na kartce A4: tytuł, data wygenerowania, tabela i łączna wartość na samym końcu.
 * Działa po stronie przeglądarki i na serwerze. Czcionka (Noto Sans, polskie znaki) jest podawana jako base64.
 */
export async function utworzPdfRemanentu(
  czesci: readonly CzescMagazynowa[],
  dataWygenerowania: string,
  czcionkaBase64: string,
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.addFileToVFS("NotoSans-Regular.ttf", czcionkaBase64);
  doc.addFont("NotoSans-Regular.ttf", "NotoSans", "normal");
  doc.setFont("NotoSans", "normal");

  let y = 20;

  function naglowekTabeli() {
    doc.setFillColor(...KOLOR_NAGLOWKA);
    doc.rect(LEWY, y, SZEROKOSC_TABELI, 8, "F");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    let x = LEWY;
    for (const kolumna of KOLUMNY) {
      if (kolumna.wyrownanie === "right") {
        doc.text(kolumna.tytul.toUpperCase(), x + kolumna.szerokosc - 2, y + 5.3, { align: "right" });
      } else {
        doc.text(kolumna.tytul.toUpperCase(), x + 2, y + 5.3);
      }
      x += kolumna.szerokosc;
    }
    doc.setTextColor(0, 0, 0);
    y += 8;
  }

  doc.setFontSize(18);
  doc.text("Remanent magazynu", LEWY, y);
  y += 7;
  doc.setFontSize(10);
  doc.text(`Data wygenerowania: ${dataWygenerowania}`, LEWY, y);
  y += 8;
  naglowekTabeli();

  czesci.forEach((czesc, indeks) => {
    const nazwa = doc.splitTextToSize(czesc.nazwa, KOLUMNY[0].szerokosc - 4) as string[];
    const kod = doc.splitTextToSize(czesc.kodKatalogowy || "—", KOLUMNY[1].szerokosc - 4) as string[];
    const producent = doc.splitTextToSize(czesc.producent || "—", KOLUMNY[2].szerokosc - 4) as string[];
    const liczbaLiniiNazwy = nazwa.length + (czesc.kategoria ? 1 : 0);
    const wysokosc = Math.max(liczbaLiniiNazwy, kod.length, producent.length) * 4.2 + 3;

    if (y + wysokosc > DOLNY_MARGINES - 14) {
      doc.addPage();
      y = 20;
      naglowekTabeli();
    }

    if (indeks % 2 === 1) {
      doc.setFillColor(...KOLOR_ZEBRY);
      doc.rect(LEWY, y, SZEROKOSC_TABELI, wysokosc, "F");
    }

    doc.setFontSize(9);
    doc.text(nazwa, LEWY + 2, y + 4.6);
    if (czesc.kategoria) {
      doc.setFontSize(7.5);
      doc.setTextColor(90, 90, 90);
      doc.text(doc.splitTextToSize(czesc.kategoria, KOLUMNY[0].szerokosc - 4)[0], LEWY + 2, y + 4.6 + nazwa.length * 4.2);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
    }
    doc.text(kod, LEWY + KOLUMNY[0].szerokosc + 2, y + 4.6);
    doc.text(producent, LEWY + KOLUMNY[0].szerokosc + KOLUMNY[1].szerokosc + 2, y + 4.6);

    let prawaKrawedz = LEWY + KOLUMNY[0].szerokosc + KOLUMNY[1].szerokosc + KOLUMNY[2].szerokosc;
    const komorki = [
      `${formatujIlosc(czesc.ilosc)} ${czesc.jednostka}`,
      formatujKwoteZl(czesc.cenaZakupuNetto),
      formatujKwoteZl(wartoscWGroszach(czesc) / 100),
    ];
    komorki.forEach((komorka, numer) => {
      prawaKrawedz += KOLUMNY[3 + numer].szerokosc;
      doc.text(liczbowy(komorka), prawaKrawedz - 2, y + 4.6, { align: "right" });
    });

    y += wysokosc;
    doc.setDrawColor(190, 190, 190);
    doc.setLineWidth(0.15);
    doc.line(LEWY, y, LEWY + SZEROKOSC_TABELI, y);
  });

  // Łączna wartość tylko raz, na samym końcu tabeli
  if (y + 14 > DOLNY_MARGINES) {
    doc.addPage();
    y = 20;
  }
  y += 3;
  doc.setDrawColor(...KOLOR_NAGLOWKA);
  doc.setLineWidth(0.5);
  doc.line(LEWY, y, LEWY + SZEROKOSC_TABELI, y);
  y += 7;
  doc.setFontSize(10.5);
  doc.text("Łączna wartość magazynu (netto):", LEWY + SZEROKOSC_TABELI - KOLUMNY[5].szerokosc - 4, y, { align: "right" });
  doc.setFontSize(12);
  doc.text(liczbowy(formatujKwoteZl(sumaWGroszach(czesci) / 100)), LEWY + SZEROKOSC_TABELI - 2, y, { align: "right" });

  const stron = doc.getNumberOfPages();
  for (let strona = 1; strona <= stron; strona += 1) {
    doc.setPage(strona);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Strona ${strona} z ${stron}`, 105, 290, { align: "center" });
  }

  return doc.output("blob");
}
