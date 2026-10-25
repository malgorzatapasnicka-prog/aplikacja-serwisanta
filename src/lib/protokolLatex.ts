import { execFile } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { DaneProtokoluPdf } from "@/lib/daneProtokolu";
import { widokProtokolu } from "@/lib/widokProtokolu";

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

function cisnienie(wartosc: string) {
  return wartosc.trim() ? tex(wartosc) : "\\dotfill~bar";
}

export function trescLatex(dane: DaneProtokoluPdf, plikiZdjec: string[] = []) {
  const widok = widokProtokolu(dane);
  const adres = widok.klientLinie.map((linia) => tex(linia)).join("\\\\\n    ");
  const status = widok.status
    ? widok.statusAwaria
      ? `\\textbf{\\textcolor{StatusErr}{${tex(widok.status)}}}`
      : `\\textbf{${tex(widok.status)}}`
    : "\\dotfill";
  const czynnosci = widok.czynnosci
    .map((pozycja) => `    \\item ${kratka(pozycja.wykonano)} ${tex(pozycja.etykieta)}`)
    .join("\n");
  const inne = widok.inneCzynnosci ? tex(widok.inneCzynnosci) : "\\dotfill";
  const kolejny = widok.dataKolejnegoPrzegladu ? tex(widok.dataKolejnegoPrzegladu) : "\\dotfill";
  const uwagi = widok.uwagi
    ? `\\vspace{0.3cm}\n${tex(widok.uwagi).replaceAll("\n", "\\\\\n")}\n\\vspace{0.4cm}`
    : "\\vspace{12cm}\n~";
  const analiza =
    plikiZdjec.length > 0
      ? plikiZdjec
          .map(
            (plik) => `\\noindent
\\fbox{%
\\begin{minipage}{0.98\\textwidth}
\\centering
\\vspace{0.3cm}
\\includegraphics[width=0.92\\textwidth,height=4.6cm,keepaspectratio]{${plik}}\\\\
\\vspace{0.3cm}
\\end{minipage}
}
\\vspace{0.35cm}`,
          )
          .join("\n")
      : `\\noindent
\\fbox{%
\\begin{minipage}{0.98\\textwidth}
\\centering
\\vspace{1.5cm}
\\textit{[Tu system automatycznie wklei zdjęcie z analizatora spalin / aparatu]}\\\\
\\vspace{1.5cm}
\\end{minipage}
}`;

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
    e-mail:${tex(widok.serwisantEmail)}
\\end{minipage}
\\hfill
\\begin{minipage}[t]{0.48\\textwidth}
    ${tex(widok.klientNazwa)}\\\\
    ${adres}
\\end{minipage}

\\vspace{0.6cm}

\\section*{1. Identyfikacja i ustawienia urządzenia}
\\rowcolors{2}{RowEven}{white}
\\noindent
\\begin{tabularx}{\\textwidth}{X l X l}
\\toprule
\\textbf{Parametr} & \\textbf{Wartość} & \\textbf{Parametr} & \\textbf{Wartość} \\\\
\\midrule
Model kotła & ${pole(widok.modelKotla)} & Numer kotła & ${pole(widok.numerKotla)} \\\\
Moc nominalna & ${pole(widok.mocNominalna)} & Typ sterownika & ${pole(widok.sterownik)} \\\\
Zadana temp. grzania & ${pole(widok.zadanaTemperatura)} & Maks. temp. zasilania & ${pole(widok.maksTemperatura)} \\\\
Status urządzenia & ${status} & & \\\\
\\bottomrule
\\end{tabularx}

\\vspace{0.5cm}

\\section*{2. Test bezpieczeństwa i szczelności}
\\rowcolors{2}{RowEven}{white}
\\noindent
\\begin{tabularx}{\\textwidth}{X l X l}
\\toprule
\\textbf{Kryterium kontrolne} & \\textbf{Status} & \\textbf{Parametr} & \\textbf{Wartość} \\\\
\\midrule
Szczelność instalacji gazowej & ${kratka(widok.szczelnoscGazowa, "Pozytywny")} & Ciśnienie w instalacji C.O. & ${cisnienie(widok.cisnienieCO)} \\\\
Zawór - kocioł & ${kratka(widok.zaworKociol)} & Ciśnienie naczynia wzbiorczego & ${cisnienie(widok.cisnienieNaczynia)} \\\\
\\bottomrule
\\end{tabularx}

\\vspace{0.5cm}

\\section*{3. Lista kontrolna wykonanych czynności}
\\noindent
\\begin{itemize}[label={}, leftmargin=1.6em]
${czynnosci}
    \\item ${kratka(Boolean(widok.inneCzynnosci))} Inne: ${inne}
\\end{itemize}
\\vspace{0.2cm}
\\noindent \\textbf{Data kolejnego przeglądu:} ${kolejny}

\\vspace{0.5cm}

\\section*{4. Uwagi serwisanta i zdiagnozowane usterki}
\\noindent
\\fbox{%
\\begin{minipage}{0.98\\textwidth}
${uwagi}
\\end{minipage}
}

\\vspace{0.5cm}

\\section*{5. Analiza spalin}
${analiza}

\\vfill

\\noindent
\\begin{minipage}[t]{0.45\\textwidth}
    \\centering
    \\vspace{1.2cm}
    \\rule{5.5cm}{0.4pt}\\\\
    \\vspace{0.15cm}
    \\small Podpis klienta
\\end{minipage}
\\hfill
\\begin{minipage}[t]{0.45\\textwidth}
    \\centering
    \\vspace{1.2cm}
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

    const plikiZdjec: string[] = [];
    for (const adres of widokProtokolu(dane).zdjecia.slice(0, 10)) {
      const dopasowanie = /^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=\s]+)$/i.exec(adres);
      if (!dopasowanie) {
        continue;
      }
      const rozszerzenie = dopasowanie[1].toLowerCase() === "png" ? "png" : "jpg";
      const nazwa = `analiza-${plikiZdjec.length + 1}.${rozszerzenie}`;
      await writeFile(join(katalog, nazwa), Buffer.from(dopasowanie[2].replace(/\s/g, ""), "base64"));
      plikiZdjec.push(nazwa);
    }

    await writeFile(join(katalog, "protokol.tex"), trescLatex(dane, plikiZdjec), "utf8");
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
