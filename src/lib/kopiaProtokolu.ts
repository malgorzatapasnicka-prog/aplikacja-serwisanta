import { FIRMA } from "@/lib/firma";
import { formatujDateIso } from "@/lib/daneProtokolu";
import { ETYKIETY_CZYNNOSCI, type CzynnoscProtokolu, type WynikKontroli } from "@/types/protokol";

export type KopiaProtokolu = {
  imieNazwisko: string;
  numerProtokolu: string;
  nazwaRaportu: string;
  dataPrzegladu: string;
  czynnosci: CzynnoscProtokolu;
  modelKotla: string;
  numerKotla: string;
  mocNominalna: string;
  sterownik: string;
  zadanaTemperaturaGrzania: string;
  maksymalnaTemperaturaZasilania: string;
  status: string;
  wynikSzczelnosci: WynikKontroli;
  cisnienieCO: string;
  wynikLancucha: WynikKontroli;
  cisnienieNaczynia: string;
  czyszczenieWymiennika: boolean;
  czyszczeniePalnika: boolean;
  sprawdzenieSyfonu: boolean;
  inneCzynnosci: string;
  dataKolejnegoPrzegladu: string;
  uwagi: string;
  zdjecia: { src: string; podpis: string }[];
  podpisKlienta: string;
  podpisSerwisanta: string;
  nazwaZalacznika: string;
};

function tekst(wartosc: string) {
  return wartosc
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pole(wartosc: string) {
  const czysta = wartosc.trim();
  return czysta ? tekst(czysta) : "—";
}

function data(wartosc: string) {
  const czysta = wartosc.trim();
  return czysta ? tekst(formatujDateIso(czysta)) : "—";
}

function wynik(wartosc: WynikKontroli) {
  if (wartosc === "pozytywny") {
    return "Pozytywny";
  }
  if (wartosc === "negatywny") {
    return "Negatywny";
  }
  return "—";
}

function takNie(wartosc: boolean) {
  return wartosc ? "Tak" : "Nie";
}

function obraz(adres: string) {
  return adres.startsWith("data:image/") ? adres : "";
}

function nazwaPliku(kopia: KopiaProtokolu) {
  const zrodlo = kopia.nazwaRaportu.trim() || kopia.numerProtokolu || "serwisowy";
  const czysta = zrodlo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `protokol-${czysta || "serwisowy"}.html`;
}

function wiersz(etykieta: string, wartosc: string) {
  return `<tr><th>${tekst(etykieta)}</th><td>${wartosc}</td></tr>`;
}

export function dokumentKopiiProtokolu(kopia: KopiaProtokolu) {
  const zdjecia = kopia.zdjecia
    .map((zdjecie, indeks) => {
      const src = obraz(zdjecie.src);
      if (!src) {
        return "";
      }
      const podpis = zdjecie.podpis.trim();
      return `<figure><img src="${src}" alt="Zdjęcie nr ${indeks + 1}">${podpis ? `<figcaption>${tekst(podpis)}</figcaption>` : ""}</figure>`;
    })
    .filter(Boolean)
    .join("");
  const podpisKlienta = obraz(kopia.podpisKlienta);
  const podpisSerwisanta = obraz(kopia.podpisSerwisanta);

  return `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${tekst(kopia.numerProtokolu || "Protokół")}</title>
<style>
  body { font-family: sans-serif; color: #1c1917; margin: 24px; line-height: 1.4; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 28px 0 8px; }
  p { margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #d6d3d1; padding: 8px; text-align: left; vertical-align: top; }
  th { width: 46%; background: #fafaf9; font-weight: 600; }
  figure { margin: 12px 0; }
  img { max-width: 100%; height: auto; }
  figcaption { font-size: 14px; margin-top: 4px; }
  .podpisy { display: flex; gap: 24px; margin-top: 12px; }
  .podpisy div { flex: 1; }
</style>
</head>
<body>
  <p>${tekst(FIRMA.nazwa)} ${tekst(FIRMA.wlasciciel)}</p>
  <p>${tekst(FIRMA.ulica)}, ${tekst(FIRMA.kod)}</p>
  <p>tel. ${tekst(FIRMA.telefon)}</p>
  <p>e-mail: ${tekst(FIRMA.email)}</p>
  <h1>Protokół</h1>
  <p>${tekst(ETYKIETY_CZYNNOSCI[kopia.czynnosci])}</p>
  <p>Nr protokołu: ${pole(kopia.numerProtokolu)}</p>
  <p>Klient: ${pole(kopia.imieNazwisko)}</p>
  <h2>Dane raportu</h2>
  <table>
    ${wiersz("Nazwa raportu", pole(kopia.nazwaRaportu))}
    ${wiersz("Data przeglądu", data(kopia.dataPrzegladu))}
  </table>
  <h2>1. Identyfikacja i ustawienia urządzenia</h2>
  <table>
    ${wiersz("Model kotła", pole(kopia.modelKotla))}
    ${wiersz("Numer kotła", pole(kopia.numerKotla))}
    ${wiersz("Moc nominalna", pole(kopia.mocNominalna))}
    ${wiersz("Typ sterownika", pole(kopia.sterownik))}
    ${wiersz("Zadana temp. grzania", pole(kopia.zadanaTemperaturaGrzania))}
    ${wiersz("Maks. temp. zasilania", pole(kopia.maksymalnaTemperaturaZasilania))}
    ${wiersz("Status urządzenia", pole(kopia.status))}
  </table>
  <h2>2. Test bezpieczeństwa i szczelności</h2>
  <table>
    ${wiersz("Szczelność instalacji gazowej (zawór-kocioł)", wynik(kopia.wynikSzczelnosci))}
    ${wiersz("Ciśnienie w instalacji C.O.", pole(kopia.cisnienieCO))}
    ${wiersz("Test łańcucha zabezpieczeń", wynik(kopia.wynikLancucha))}
    ${wiersz("Ciśnienie wstępne w naczyniu wzbiorczym", pole(kopia.cisnienieNaczynia))}
  </table>
  <h2>3. Lista kontrolna wykonanych czynności</h2>
  <table>
    ${wiersz("Czyszczenie wymiennika ciepła", takNie(kopia.czyszczenieWymiennika))}
    ${wiersz("Czyszczenie palnika i elektrod", takNie(kopia.czyszczeniePalnika))}
    ${wiersz("Sprawdzenie syfonu kondensatu", takNie(kopia.sprawdzenieSyfonu))}
    ${wiersz("Inne", pole(kopia.inneCzynnosci))}
    ${wiersz("Data kolejnego przeglądu", data(kopia.dataKolejnegoPrzegladu))}
  </table>
  <h2>4. Uwagi serwisanta i zdiagnozowane usterki</h2>
  <p>${pole(kopia.uwagi).replaceAll("\n", "<br>")}</p>
  <h2>5. Załączniki</h2>
  ${zdjecia || "<p>—</p>"}
  ${kopia.nazwaZalacznika.trim() ? `<p>Załącznik PDF: ${tekst(kopia.nazwaZalacznika.trim())}</p>` : ""}
  <h2>Podpisy</h2>
  <div class="podpisy">
    <div><p>Podpis klienta</p>${podpisKlienta ? `<img src="${podpisKlienta}" alt="Podpis klienta">` : "<p>—</p>"}</div>
    <div><p>Podpis serwisanta</p>${podpisSerwisanta ? `<img src="${podpisSerwisanta}" alt="Podpis serwisanta">` : "<p>—</p>"}</div>
  </div>
</body>
</html>`;
}

type UchwytZapisu = {
  createWritable: () => Promise<{ write: (dane: Blob) => Promise<void>; close: () => Promise<void> }>;
};

type OknoZapisu = Window & {
  showSaveFilePicker?: (opcje: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<UchwytZapisu>;
};

export async function zapiszKopieProtokoluNaTelefonie(kopia: KopiaProtokolu) {
  const nazwa = nazwaPliku(kopia);
  const plik = new File([dokumentKopiiProtokolu(kopia)], nazwa, { type: "text/html" });
  const okno = window as OknoZapisu;

  if (typeof okno.showSaveFilePicker === "function") {
    const uchwyt = await okno.showSaveFilePicker({
      suggestedName: nazwa,
      types: [{ description: "Protokół", accept: { "text/html": [".html"] } }],
    });
    const zapis = await uchwyt.createWritable();
    await zapis.write(plik);
    await zapis.close();
    return;
  }

  if (navigator.canShare?.({ files: [plik] })) {
    await navigator.share({ files: [plik], title: nazwa });
    return;
  }

  const adres = URL.createObjectURL(plik);
  const link = document.createElement("a");
  link.href = adres;
  link.download = nazwa;
  link.click();
  URL.revokeObjectURL(adres);
}
