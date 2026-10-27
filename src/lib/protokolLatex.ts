import { execFile } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { DaneProtokoluPdf } from "@/lib/daneProtokolu";
import { widokProtokolu } from "@/lib/widokProtokolu";
import type { WynikKontroli } from "@/types/protokol";

const uruchom = promisify(execFile);

function tex(wartosc: string) {
  return wartosc
    .replaceAll("\\", "\\textbackslash{}")
    .replaceAll("&", "\\&")
    .replaceAll("%", "\\%")
    .replaceAll("$", "\\$")
    .replaceAll("#", "\\#")
    .replaceAll("_", "\\_")
    .replaceAll("{", "\\{")
    .replaceAll("}", "\\}")
    .replaceAll("~", "\\textasciitilde{}")
    .replaceAll("^", "\\textasciicircum{}")
    .replaceAll("°C", "$^\\circ$C")
    .replaceAll("°", "$^\\circ$");
}

function pole(wartosc: string) {
  const czysta = wartosc.trim();
  return czysta ? tex(czysta) : "\\dotfill";
}

function kratka(zaznaczone: boolean, dopisek = "") {
  const pudelko = zaznaczone ? "\\mbox{[\\,$\\times$\\,]}" : "\\mbox{[\\hspace{0.3cm}]}";
  return dopisek ? `${pudelko} ${tex(dopisek)}` : pudelko;
}

function statusWyniku(wynik: WynikKontroli) {
  return `\\begin{minipage}[t]{4.2cm}\\raggedright ${kratka(wynik === "pozytywny", "Pozytywny")}\\\\[0.4mm] ${kratka(wynik === "negatywny", "Negatywny")}\\\\[0.4mm] ${kratka(wynik === "nie_dotyczy", "Nie dotyczy")}\\end{minipage}`;
}

function wartoscLubNieDotyczy(nieDotyczy: boolean, wartosc: string, pusta: string) {
  if (nieDotyczy) {
    return tex("Nie dotyczy");
  }
  return wartosc.trim() ? tex(wartosc) : pusta;
}

function tabelaPol(wiersze: Array<[string, string]>) {
  if (wiersze.length === 0) {
    return "";
  }
  const tresc = wiersze.map(([etykieta, wartosc]) => `${tex(etykieta)} & ${wartosc} \\\\`).join("\n");
  return `\\rowcolors{2}{RowEven}{white}
\\noindent
\\begin{tabularx}{\\textwidth}{X l}
\\toprule
\\textbf{Parametr} & \\textbf{Wartość} \\\\
\\midrule
${tresc}
\\bottomrule
\\end{tabularx}`;
}

function sekcja(tytul: string, tresc: string) {
  const czysta = tresc.trim();
  if (!czysta) {
    return "";
  }
  return `\\section*{${tytul}}\n${czysta}\n\\vspace{0.5cm}\n`;
}

function kolumnaZdjecia(plik: string, podpis: string, szerokosc: string, wysokosc: string) {
  const opis = podpis.trim() ? `\\\\[0.15cm]\n{\\small ${tex(podpis.trim())}}` : "";
  return `\\begin{minipage}[t]{${szerokosc}}
\\centering
\\includegraphics[width=\\linewidth,height=${wysokosc},keepaspectratio]{${plik}}${opis}
\\end{minipage}`;
}

function ukladZdjec(pliki: { plik: string; podpis: string }[]) {
  if (pliki.length === 1) {
    const jedyne = pliki[0];
    return `\\noindent
\\begin{center}
${kolumnaZdjecia(jedyne.plik, jedyne.podpis, "0.78\\textwidth", "8.2cm")}
\\end{center}
\\vspace{0.4cm}`;
  }

  const wiersze: string[] = [];
  for (let indeks = 0; indeks < pliki.length; indeks += 2) {
    const lewe = pliki[indeks];
    const prawe = pliki[indeks + 1];
    const lewaRamka = kolumnaZdjecia(lewe.plik, lewe.podpis, "0.48\\textwidth", "7.4cm");
    const prawaRamka = prawe
      ? kolumnaZdjecia(prawe.plik, prawe.podpis, "0.48\\textwidth", "7.4cm")
      : "\\begin{minipage}[t]{0.48\\textwidth}~\\end{minipage}";
    wiersze.push(`\\noindent
${lewaRamka}
\\hfill
${prawaRamka}
\\par
\\vspace{0.45cm}`);
  }
  return wiersze.join("\n");
}

export function trescLatex(
  dane: DaneProtokoluPdf,
  plikiZdjec: { plik: string; podpis: string }[] = [],
  plikPodpisuKlienta = "",
  plikPodpisuSerwisanta = "",
) {
  const widok = widokProtokolu(dane);
  const adres = widok.klientLinie.map((linia) => tex(linia)).join("\\\\\n    ");
  const status = widok.statusAwaria
    ? `\\textbf{\\textcolor{StatusErr}{${tex(widok.status)}}}`
    : `\\textbf{${tex(widok.status)}}`;
  const identyfikacja: Array<[string, string]> = [
    ["Model kotła", pole(widok.modelKotla)],
    ["Numer kotła", pole(widok.numerKotla)],
    ["Moc nominalna", pole(widok.mocNominalna)],
    ["Typ sterownika", pole(widok.sterownik)],
    ["Zadana temp. grzania", pole(widok.zadanaTemperatura)],
    ["Maks. temp. zasilania", pole(widok.maksTemperatura)],
    ["Status urządzenia", widok.status.trim() ? status : "\\dotfill"],
  ];
  const bezpieczenstwo: Array<[string, string]> = [
    ["Szczelność instalacji gazowej (zawór-kocioł)", statusWyniku(widok.wynikSzczelnosci)],
    ["Ciśnienie w instalacji C.O.", wartoscLubNieDotyczy(widok.cisnienieCONieDotyczy, widok.cisnienieCO, "\\dotfill~bar")],
    ["Test łańcucha zabezpieczeń", statusWyniku(widok.wynikLancucha)],
    [
      "Ciśnienie wstępne w naczyniu wzbiorczym",
      wartoscLubNieDotyczy(widok.cisnienieNaczyniaNieDotyczy, widok.cisnienieNaczynia, "\\dotfill~bar"),
    ],
  ];
  const pozycjeListy = widok.czynnosci.map(
    (pozycja) =>
      `    \\item ${kratka(pozycja.stan === "wykonano")} ${tex(pozycja.etykieta)}\\quad ${kratka(pozycja.stan === "nie_dotyczy", "Nie dotyczy")}`,
  );
  const inne = widok.inneNieDotyczy ? "" : widok.inneCzynnosci ? tex(widok.inneCzynnosci) : "\\dotfill";
  const kolejny = widok.kolejnyPrzegladNieDotyczy
    ? tex("Nie dotyczy")
    : widok.dataKolejnegoPrzegladu
      ? tex(widok.dataKolejnegoPrzegladu)
      : "\\dotfill";
  const listaCzynnosci = `\\noindent
\\begin{itemize}[label={}, leftmargin=1.6em]
${pozycjeListy.join("\n")}
    \\item ${kratka(!widok.inneNieDotyczy && Boolean(widok.inneCzynnosci))} Inne: ${inne}\\quad ${kratka(widok.inneNieDotyczy, "Nie dotyczy")}
\\end{itemize}
\\vspace{0.2cm}
\\noindent \\textbf{Data kolejnego przeglądu:} ${kolejny}`;
  const uwagi = widok.uwagi
    ? `\\noindent\n\\fbox{%\n\\begin{minipage}{0.98\\textwidth}\n\\vspace{0.3cm}\n${tex(widok.uwagi).replaceAll("\n", "\\\\\n")}\n\\vspace{0.4cm}\n\\end{minipage}\n}`
    : `\\noindent\n\\fbox{%\n\\begin{minipage}{0.98\\textwidth}\n\\vspace{3cm}\n~\n\\end{minipage}\n}`;
  const analiza = plikiZdjec.length > 0 ? ukladZdjec(plikiZdjec) : "~";
  const miejscePodpisu = plikPodpisuKlienta
    ? `\\includegraphics[width=5.2cm,height=1.5cm,keepaspectratio]{${plikPodpisuKlienta}}\\\\[-1.5mm]`
    : "\\vspace{1.2cm}";
  const miejscePodpisuSerwisanta = plikPodpisuSerwisanta
    ? `\\includegraphics[width=5.2cm,height=1.5cm,keepaspectratio]{${plikPodpisuSerwisanta}}\\\\[-1.5mm]`
    : "\\vspace{1.2cm}";

  return `\\documentclass[10pt, a4paper]{article}

\\usepackage[a4paper, margin=2cm]{geometry}
\\usepackage{fontspec}
\\usepackage[polish, bidi=basic, provide=*]{babel}
\\babelprovide[import, onchar=ids fonts]{polish}
\\babelfont{rm}[
  Path=./,
  Extension=.ttf,
  UprightFont=NotoSans-Regular,
  BoldFont=NotoSans-Regular,
  BoldFeatures={FakeBold=2}
]{NotoSans}

\\usepackage{tabularx}
\\usepackage{booktabs}
\\usepackage[table]{xcolor}
\\usepackage{enumitem}
\\usepackage{graphicx}

\\definecolor{HeaderBg}{HTML}{1E293B}
\\definecolor{RowEven}{HTML}{F8FAFC}
\\definecolor{StatusErr}{HTML}{DC2626}
\\definecolor{BorderGray}{HTML}{CBD5E1}

\\renewcommand{\\arraystretch}{1.25}

\\begin{document}

\\noindent
\\begin{minipage}[c]{0.5\\textwidth}
    ~
\\end{minipage}
\\hfill
\\begin{minipage}[c]{0.48\\textwidth}
    \\raggedleft
    \\textbf{Data przeglądu:} ${pole(widok.dataPrzegladu)}\\\\
    \\textbf{Nr protokołu:} ${pole(widok.numerProtokolu)}
\\end{minipage}

\\vspace{0.4cm}
\\hrule height 1.5pt
\\vspace{0.5cm}

\\begin{center}
    {\\LARGE \\textbf{PROTOKÓŁ}}\\\\[0.15cm]
    {\\normalsize ${tex(widok.podtytul)}}
\\end{center}

\\vspace{0.4cm}

\\noindent
\\begin{minipage}[t]{0.48\\textwidth}
    \\textbf{Serwisant}\\\\
    ${tex(widok.serwisantNazwa)}\\\\
    Tel: ${tex(widok.serwisantTelefon)}\\\\
    e-mail: ${tex(widok.serwisantEmail)}
\\end{minipage}
\\hfill
\\begin{minipage}[t]{0.48\\textwidth}
    ${tex(widok.klientNazwa)}\\\\
    ${adres}
\\end{minipage}

\\vspace{0.6cm}

${sekcja("1. Identyfikacja i ustawienia urządzenia", tabelaPol(identyfikacja))}
${sekcja("2. Test bezpieczeństwa i szczelności", tabelaPol(bezpieczenstwo))}
${sekcja("3. Lista kontrolna wykonanych czynności", listaCzynnosci)}
${sekcja("4. Uwagi serwisanta i zdiagnozowane usterki", uwagi)}
${sekcja("5. Załączniki", analiza)}
\\vfill

\\noindent
\\begin{minipage}[b]{0.45\\textwidth}
    \\centering
    ${miejscePodpisu}
    \\rule{5.5cm}{0.4pt}\\\\
    \\vspace{0.15cm}
    \\small Podpis klienta
\\end{minipage}
\\hfill
\\begin{minipage}[b]{0.45\\textwidth}
    \\centering
    ${miejscePodpisuSerwisanta}
    \\rule{5.5cm}{0.4pt}\\\\
    \\vspace{0.15cm}
    \\small Podpis i pieczęć serwisanta
\\end{minipage}

\\end{document}
`;
}

export async function utworzPdfLatex(dane: DaneProtokoluPdf): Promise<Buffer | null> {
  const katalog = await mkdtemp(join(tmpdir(), "protokol-"));

  try {
    await copyFile(
      join(process.cwd(), "src/lib/fonts/NotoSans-Regular.ttf"),
      join(katalog, "NotoSans-Regular.ttf"),
    );

    const widok = widokProtokolu(dane);
    const plikiZdjec: { plik: string; podpis: string }[] = [];
    for (const [indeks, adres] of widok.zdjecia.slice(0, 10).entries()) {
      const dopasowanie = /^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=\s]+)$/i.exec(adres);
      if (!dopasowanie) {
        continue;
      }
      const rozszerzenie = dopasowanie[1].toLowerCase() === "png" ? "png" : "jpg";
      const nazwa = `analiza-${plikiZdjec.length + 1}.${rozszerzenie}`;
      await writeFile(join(katalog, nazwa), Buffer.from(dopasowanie[2].replace(/\s/g, ""), "base64"));
      plikiZdjec.push({ plik: nazwa, podpis: widok.podpisyZdjec[indeks] ?? "" });
    }

    let plikPodpisu = "";
    const dopasowaniePodpisu = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/i.exec(widok.podpisKlienta);
    if (dopasowaniePodpisu) {
      plikPodpisu = "podpis-klienta.png";
      await writeFile(
        join(katalog, plikPodpisu),
        Buffer.from(dopasowaniePodpisu[1].replace(/\s/g, ""), "base64"),
      );
    }

    let plikPodpisuSerwisanta = "";
    const dopasowanieSerwisanta = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/i.exec(widok.podpisSerwisanta);
    if (dopasowanieSerwisanta) {
      plikPodpisuSerwisanta = "podpis-serwisanta.png";
      await writeFile(
        join(katalog, plikPodpisuSerwisanta),
        Buffer.from(dopasowanieSerwisanta[1].replace(/\s/g, ""), "base64"),
      );
    }

    await writeFile(
      join(katalog, "protokol.tex"),
      trescLatex(dane, plikiZdjec, plikPodpisu, plikPodpisuSerwisanta),
      "utf8",
    );
    await uruchom(
      "lualatex",
      ["-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error", "protokol.tex"],
      { cwd: katalog, timeout: 45_000 },
    );
    return await readFile(join(katalog, "protokol.pdf"));
  } catch (error) {
    const kod = error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (kod !== "ENOENT") {
      console.error("Nie udało się złożyć protokołu w LaTeX.", error);
    }
    return null;
  } finally {
    await rm(katalog, { recursive: true, force: true });
  }
}
