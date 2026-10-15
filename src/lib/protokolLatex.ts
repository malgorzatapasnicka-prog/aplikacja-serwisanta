import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { FIRMA } from "@/lib/firma";
import { formatujDateIso, type DaneProtokoluPdf } from "@/lib/daneProtokolu";
import { ETYKIETY_CZYNNOSCI } from "@/types/protokol";

const uruchom = promisify(execFile);

function tex(wartosc: string) {
  return (wartosc.trim() || "—")
    .replaceAll("\\", "\\textbackslash{}")
    .replaceAll("&", "\\&")
    .replaceAll("%", "\\%")
    .replaceAll("$", "\\$")
    .replaceAll("#", "\\#")
    .replaceAll("_", "\\_")
    .replaceAll("{", "\\{")
    .replaceAll("}", "\\}")
    .replaceAll("~", "\\textasciitilde{}")
    .replaceAll("^", "\\textasciicircum{}");
}

function wiersze(pary: Array<[string, string]>) {
  return pary
    .map(
      ([etykieta, wartosc]) =>
        `\\wiersz{${tex(etykieta)}}{${tex(wartosc)}}`,
    )
    .join("\n");
}

export function trescLatex(dane: DaneProtokoluPdf) {
  const raport = dane.protokol;
  const czynnosci = ETYKIETY_CZYNNOSCI[raport.czynnosci];
  const kociol = [dane.numerKotla, dane.nazwaKotla].filter((wartosc) => wartosc.trim()).join(" · ");

  return `\\documentclass[a4paper,11pt]{article}
\\usepackage[T1]{fontenc}
\\usepackage[utf8]{inputenc}
\\usepackage[polish]{babel}
\\usepackage[margin=16mm,top=18mm,headheight=16pt,footskip=12mm]{geometry}
\\usepackage{tgheros}
\\usepackage{microtype}
\\usepackage{xcolor}
\\usepackage{tabularx}
\\usepackage{array}
\\usepackage{fancyhdr}
\\renewcommand{\\familydefault}{\\sfdefault}

\\definecolor{ink}{HTML}{0F172A}
\\definecolor{muted}{HTML}{64748B}
\\definecolor{line}{HTML}{CBD5E1}
\\definecolor{rule}{HTML}{0F172A}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyhead[L]{\\textcolor{ink}{\\small\\bfseries ${tex(FIRMA.nazwa)}}\\ \\textcolor{muted}{\\small ${tex(FIRMA.wlasciciel)}}}
\\fancyhead[R]{\\textcolor{muted}{\\small tel. ${tex(FIRMA.telefon)}}}
\\renewcommand{\\headrulewidth}{0.4pt}
\\renewcommand{\\headrule}{\\hbox to\\headwidth{\\color{line}\\leaders\\hrule height \\headrulewidth\\hfill}}
\\fancyfoot[L]{\\textcolor{muted}{\\footnotesize ${tex(FIRMA.ulica)}, ${tex(FIRMA.kod)}}}
\\fancyfoot[R]{\\textcolor{muted}{\\footnotesize \\thepage}}
\\renewcommand{\\footrulewidth}{0pt}

\\fancypagestyle{pierwsza}{%
  \\fancyhf{}%
  \\renewcommand{\\headrulewidth}{0pt}%
  \\fancyfoot[L]{\\textcolor{muted}{\\footnotesize ${tex(FIRMA.ulica)}, ${tex(FIRMA.kod)}}}%
  \\fancyfoot[R]{\\textcolor{muted}{\\footnotesize \\thepage}}%
}

\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0pt}
\\pagestyle{fancy}

\\newcommand{\\sekcja}[1]{%
  \\vspace{6mm}%
  {\\large\\bfseries\\color{ink} #1}\\par
  \\vspace{1.4mm}{\\color{rule}\\rule{\\textwidth}{0.6pt}}\\par
  \\vspace{3mm}%
}
\\newcommand{\\wiersz}[2]{%
  \\noindent
  \\begin{tabularx}{\\textwidth}{@{}>{\\color{muted}\\raggedright\\arraybackslash}p{58mm} >{\\raggedright\\arraybackslash}X@{}}
    #1 & #2 \\\\
  \\end{tabularx}\\par
  \\vspace{1.5mm}{\\color{line}\\rule{\\textwidth}{0.25pt}}\\par
  \\vspace{2mm}%
}

\\begin{document}
\\thispagestyle{pierwsza}
\\color{ink}

{\\fontsize{22}{26}\\selectfont\\bfseries ${tex(FIRMA.nazwa)}}\\\\[1.5mm]
{\\large ${tex(FIRMA.wlasciciel)}}\\\\[2.5mm]
{\\color{muted}${tex(FIRMA.ulica)}\\\\[0.8mm]
${tex(FIRMA.kod)}\\\\[0.8mm]
tel. ${tex(FIRMA.telefon)}}

\\vspace{6mm}
{\\color{rule}\\rule{\\textwidth}{1.1pt}}
\\vspace{7mm}

{\\fontsize{16}{20}\\selectfont\\bfseries Protokół serwisowy}\\\\[2.5mm]
{\\large ${tex(raport.nazwaRaportu)}}\\\\[1.5mm]
{\\color{muted} Data wypełnienia: ${tex(formatujDateIso(raport.dataWypelnienia))}
\\quad\\textperiodcentered\\quad ${tex(czynnosci)}}

\\sekcja{Dane klienta}
${wiersze([
  ["Imię i nazwisko", dane.imieNazwisko],
  ["Adres", dane.adres],
  ["Numer kotła", kociol || dane.numerKotla],
])}

\\sekcja{Przeprowadzone czynności}
${wiersze([["Rodzaj", czynnosci]])}

\\sekcja{Dane urządzenia}
${wiersze([
  ["Status", raport.status],
  ["Typ kotła", raport.typKotla],
  ["Moc nominalna kotła", raport.mocNominalna],
  ["Sterownik", raport.sterownik],
  ["Nr seryjny", raport.numerSeryjny],
])}

\\sekcja{Ustawienia urządzenia}
${wiersze([
  ["Grzanie", raport.grzanie],
  ["Maksymalna temperatura zasilania", raport.maksymalnaTemperaturaZasilania],
])}

\\vspace{16mm}
\\noindent
\\begin{tabularx}{\\textwidth}{@{}X X@{}}
\\color{muted}\\small Podpis serwisanta & \\color{muted}\\small Data wypełnienia \\\\
\\rule{0pt}{14mm} & \\\\
\\color{line}\\rule{72mm}{0.4pt} & \\color{line}\\rule{52mm}{0.4pt} \\\\
\\color{ink}\\small ${tex(FIRMA.wlasciciel)} & \\color{ink}\\small ${tex(formatujDateIso(raport.dataWypelnienia))} \\\\
\\end{tabularx}

\\end{document}
`;
}

export async function utworzPdfLatex(dane: DaneProtokoluPdf): Promise<Buffer | null> {
  const katalog = await mkdtemp(join(tmpdir(), "protokol-"));

  try {
    await writeFile(join(katalog, "protokol.tex"), trescLatex(dane), "utf8");
    await uruchom(
      "pdflatex",
      ["-no-shell-escape", "-interaction=nonstopmode", "-halt-on-error", "protokol.tex"],
      { cwd: katalog, timeout: 30_000 },
    );
    return await readFile(join(katalog, "protokol.pdf"));
  } catch (error) {
    const kod =
      error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (kod !== "ENOENT") {
      console.error("Nie udało się złożyć protokołu w LaTeX.", error);
    }
    return null;
  } finally {
    await rm(katalog, { recursive: true, force: true });
  }
}
