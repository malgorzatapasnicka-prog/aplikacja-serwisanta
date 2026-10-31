import { FIRMA } from "@/lib/firma";
import { formatujDateIso } from "@/lib/daneProtokolu";
import {
  ETYKIETY_CHECKLISTY,
  ETYKIETY_CZYNNOSCI,
  GRUPY_CHECKLISTY,
  type ChecklistaProtokolu,
  type CzynnoscProtokolu,
  type StanCzynnosci,
  type WynikKontroli,
} from "@/types/protokol";

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
  cisnienieCONieDotyczy: boolean;
  wynikLancucha: WynikKontroli;
  cisnienieNaczynia: string;
  cisnienieNaczyniaNieDotyczy: boolean;
  czyszczenieWymiennika: StanCzynnosci;
  czyszczeniePalnika: StanCzynnosci;
  sprawdzenieSyfonu: StanCzynnosci;
  inneCzynnosci: string;
  inneNieDotyczy: boolean;
  dataKolejnegoPrzegladu: string;
  kolejnyPrzegladNieDotyczy: boolean;
  uwagi: string;
  zdjecia: { src: string; podpis: string }[];
  podpisKlienta: string;
  podpisSerwisanta: string;
  nazwaZalacznika: string;
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

function wynik(wartosc: WynikKontroli) {
  if (wartosc === "pozytywny") {
    return "Pozytywny";
  }
  if (wartosc === "negatywny") {
    return "Negatywny";
  }
  if (wartosc === "nie_dotyczy") {
    return "Nie dotyczy";
  }
  return "—";
}

function stan(wartosc: StanCzynnosci) {
  if (wartosc === "wykonano") {
    return "Tak";
  }
  if (wartosc === "nie_dotyczy") {
    return "Nie dotyczy";
  }
  return "Nie";
}

function poleAlboNieDotyczy(wartosc: string, nieDotyczy: boolean) {
  if (nieDotyczy) {
    return "Nie dotyczy";
  }
  return wartosc.trim() ? wartosc.trim() : "—";
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

function kwota(wartosc: number | undefined) {
  if (typeof wartosc !== "number" || !Number.isFinite(wartosc)) {
    return "";
  }
  return `${wartosc.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

function blokRozszerzenia(kopia: KopiaProtokolu) {
  const urzadzenie = (
    [
      ["Model urządzenia", kopia.modelUrzadzenia ?? ""],
      ["Numer fabryczny", kopia.numerFabryczny ?? ""],
      ["Rodzaj gazu", kopia.rodzajGazu ?? ""],
    ] as Array<[string, string]>
  ).filter((wiersz) => wiersz[1].trim());
  const opis = (kopia.opisUslugi ?? "").trim();
  const pomiary = (
    [
      ["Ciśnienie gazu statycznego / na przyłączu", kopia.cisnienieGazuStatyczne ?? ""],
      ["Ciśnienie wody w instalacji grzewczej", kopia.cisnienieWodyGrzewczej ?? ""],
      ["Ciśnienie wstępne w naczyniu wzbiorczym", kopia.cisnienieWstepneNaczynia ?? ""],
    ] as Array<[string, string]>
  ).filter((wiersz) => wiersz[1].trim());
  const koszty = [
    ["Usługa", kwota(kopia.uslugaNetto), kwota(kopia.uslugaBrutto)],
    ["Dojazd", kwota(kopia.dojazdNetto), kwota(kopia.dojazdBrutto)],
    ["Części/Materiały", kwota(kopia.materialyNetto), kwota(kopia.materialyBrutto)],
  ].filter((wiersz) => wiersz[1] || wiersz[2]);
  const checklista = GRUPY_CHECKLISTY.map((grupa) => {
    const pozycje = grupa.pola.flatMap(([klucz, etykieta]) => {
      const stan = kopia.checklista?.[klucz];
      return stan ? [`<li>${tekst(etykieta)}: <strong>${tekst(ETYKIETY_CHECKLISTY[stan])}</strong></li>`] : [];
    });
    return pozycje.length > 0 ? `<p><strong>${tekst(grupa.tytul)}</strong></p><ul>${pozycje.join("")}</ul>` : "";
  }).join("");

  return {
    urzadzenie:
      urzadzenie.length > 0 || opis
        ? `${urzadzenie.length > 0 ? tabelaPelna(urzadzenie) : ""}${opis ? `<p>${tekst(opis).replaceAll("\n", "<br>")}</p>` : ""}`
        : "",
    pomiary: pomiary.length > 0 ? tabelaPelna(pomiary) : "",
    checklista,
    koszty:
      koszty.length > 0
        ? `<table><tr><th></th><th>Netto</th><th>Brutto</th></tr>${koszty
            .map(([nazwa, netto, brutto]) => `<tr><td>${tekst(nazwa)}</td><td>${tekst(netto || "—")}</td><td>${tekst(brutto || "—")}</td></tr>`)
            .join("")}</table>`
        : "",
    oswiadczenie: kopia.powierzchniaDo300
      ? "<p>Oświadczam, że powierzchnia użytkowa budynku mieszkalnego jednorodzinnego nie przekracza 300 mkw.</p>"
      : "",
  };
}

function tabelaPelna(wiersze: Array<[string, string]>) {
  return `<table>${wiersze.map(([etykieta, wartosc]) => wiersz(etykieta, tekst(wartosc.trim() || "—"))).join("")}</table>`;
}

function sekcja(tytul: string, tresc: string) {
  const czysta = tresc.trim();
  return czysta ? `<h2>${tekst(tytul)}</h2>\n  ${czysta}` : "";
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
  const rozszerzenie = blokRozszerzenia(kopia);
  const podpisy = [
    podpisKlienta ? `<div><p>Podpis klienta</p><img src="${podpisKlienta}" alt="Podpis klienta"></div>` : "",
    podpisSerwisanta ? `<div><p>Podpis serwisanta</p><img src="${podpisSerwisanta}" alt="Podpis serwisanta"></div>` : "",
  ].join("");

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
  ${sekcja(
    "Dane raportu",
    tabelaPelna([
      ["Nazwa raportu", kopia.nazwaRaportu],
      ["Data przeglądu", kopia.dataPrzegladu.trim() ? formatujDateIso(kopia.dataPrzegladu) : ""],
    ]),
  )}
  ${sekcja(
    "1. Identyfikacja i ustawienia urządzenia",
    tabelaPelna([
      ["Model kotła", kopia.modelKotla],
      ["Numer kotła", kopia.numerKotla],
      ["Moc nominalna", kopia.mocNominalna],
      ["Typ sterownika", kopia.sterownik],
      ["Zadana temp. grzania", kopia.zadanaTemperaturaGrzania],
      ["Maks. temp. zasilania", kopia.maksymalnaTemperaturaZasilania],
      ["Status urządzenia", kopia.status],
    ]),
  )}
  ${sekcja("Urządzenie", rozszerzenie.urzadzenie)}
  ${sekcja(
    "2. Test bezpieczeństwa i szczelności",
    tabelaPelna([
      ["Szczelność instalacji gazowej (zawór-kocioł)", wynik(kopia.wynikSzczelnosci)],
      ["Ciśnienie w instalacji C.O.", poleAlboNieDotyczy(kopia.cisnienieCO, kopia.cisnienieCONieDotyczy)],
      ["Test łańcucha zabezpieczeń", wynik(kopia.wynikLancucha)],
      ["Ciśnienie wstępne w naczyniu wzbiorczym", poleAlboNieDotyczy(kopia.cisnienieNaczynia, kopia.cisnienieNaczyniaNieDotyczy)],
    ]),
  )}
  ${sekcja("Pomiary", rozszerzenie.pomiary)}
  ${sekcja(
    "3. Lista kontrolna wykonanych czynności",
    tabelaPelna([
      ["Czyszczenie wymiennika ciepła", stan(kopia.czyszczenieWymiennika)],
      ["Czyszczenie palnika i elektrod", stan(kopia.czyszczeniePalnika)],
      ["Sprawdzenie syfonu kondensatu", stan(kopia.sprawdzenieSyfonu)],
      ["Inne", poleAlboNieDotyczy(kopia.inneCzynnosci, kopia.inneNieDotyczy)],
      [
        "Data kolejnego przeglądu",
        kopia.kolejnyPrzegladNieDotyczy
          ? "Nie dotyczy"
          : kopia.dataKolejnegoPrzegladu.trim()
            ? formatujDateIso(kopia.dataKolejnegoPrzegladu)
            : "",
      ],
    ]),
  )}
  ${sekcja("Checklista czynności serwisowych", rozszerzenie.checklista)}
  ${sekcja("4. Uwagi serwisanta i zdiagnozowane usterki", `<p>${kopia.uwagi.trim() ? tekst(kopia.uwagi).replaceAll("\n", "<br>") : "—"}</p>`)}
  ${sekcja("Rozliczenie", rozszerzenie.koszty)}
  ${sekcja(
    "5. Załączniki",
    `${zdjecia || "<p>—</p>"}${kopia.nazwaZalacznika.trim() ? `<p>Załącznik PDF: ${tekst(kopia.nazwaZalacznika.trim())}</p>` : ""}`,
  )}
  ${sekcja("Oświadczenie", rozszerzenie.oswiadczenie)}
  ${sekcja("Podpisy", podpisy ? `<div class="podpisy">${podpisy}</div>` : "<p>—</p>")}
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
