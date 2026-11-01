import { execFile } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { DaneProtokoluPdf } from "@/lib/daneProtokolu";
import {
  TEKST_STOPKI,
  UDZIAL_KOLORU_W_TLE,
  kolorFirmowyHex,
  kolorZebryHex,
  logoWbudowane,
  type LogoPdf,
} from "@/lib/identyfikacjaWizualna";
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
  // Zaznaczony wynik negatywny (usterka) jest pogrubiony i czerwony, żeby od razu rzucał się w oczy.
  const negatywny = kratka(wynik === "negatywny", "Negatywny");
  const negatywnyWyrozniony = wynik === "negatywny" ? `\\textbf{\\textcolor{StatusErr}{${negatywny}}}` : negatywny;
  return `\\begin{minipage}[t]{4.2cm}\\raggedright ${kratka(wynik === "pozytywny", "Pozytywny")}\\\\[0.4mm] ${negatywnyWyrozniony}\\\\[0.4mm] ${kratka(wynik === "nie_dotyczy", "Nie dotyczy")}\\end{minipage}`;
}

function wartoscLubNieDotyczy(nieDotyczy: boolean, wartosc: string, pusta: string) {
  if (nieDotyczy) {
    return tex("Nie dotyczy");
  }
  return wartosc.trim() ? tex(wartosc) : pusta;
}

// Status pozycji checklisty. „Wykonano” to wyłącznie znacznik (pole z ptaszkiem), bez powtarzanego
// słowa. Pozostałe stany mają znacznik i krótki opis, bo niosą dodatkową informację.
function statusChecklisty(kod: "wykonano" | "brak" | "wymieniono" | "nie_dotyczy", etykieta: string) {
  const opis = tex(etykieta.toLowerCase());
  switch (kod) {
    case "wykonano":
      return "\\PoleWyboru{Firmowy}{\\textcolor{Firmowy}{$\\checkmark$}}";
    case "wymieniono":
      return `\\PoleWyboru{Firmowy}{\\textcolor{Firmowy}{$\\checkmark$}}\\,\\textcolor{Firmowy}{\\small ${opis}}`;
    case "brak":
      return `\\PoleWyboru{StatusErr}{}\\,\\textbf{\\textcolor{StatusErr}{\\small ${opis}}}`;
    default:
      return `\\PoleWyboru{gray}{\\textcolor{gray}{\\scriptsize --}}\\,\\textcolor{gray}{\\small ${opis}}`;
  }
}

// Tabela dwukolumnowa: granatowy nagłówek z białym tekstem, wiersze na przemian białe i w delikatnym
// szarym odcieniu („zebra”). Wartości są zwykłą czcionką. Pogrubienie dostają tylko wpisy oznaczające
// usterki lub ważne uwagi (przygotowane wcześniej jako \textbf{...}).
function tabelaPol(
  wiersze: Array<[string, string]>,
  naglowki: [string, string] = ["Parametr", "Wartość"],
  srodkowaDruga = false,
) {
  if (wiersze.length === 0) {
    return "";
  }
  const tresc = wiersze
    .map(([etykieta, wartosc], indeks) => `${indeks % 2 === 1 ? "\\rowcolor{Zebra}" : ""}${tex(etykieta)} & ${wartosc} \\\\`)
    .join("\n");
  const kolumny = srodkowaDruga
    ? ">{\\raggedright\\arraybackslash}X >{\\centering\\arraybackslash}p{3.6cm}"
    : ">{\\raggedright\\arraybackslash}X >{\\raggedright\\arraybackslash}X";
  return `\\noindent
\\begin{tabularx}{\\textwidth}{${kolumny}}
\\rowcolor{Firmowy}\\textbf{\\textcolor{white}{${tex(naglowki[0])}}} & \\textbf{\\textcolor{white}{${tex(naglowki[1])}}} \\\\
${tresc}
\\arrayrulecolor{Firmowy}\\bottomrule
\\end{tabularx}`;
}

function sekcja(tytul: string, tresc: string) {
  const czysta = tresc.trim();
  if (!czysta) {
    return "";
  }
  return `\\par\\vspace{0.95em}\n\\noindent{\\large\\bfseries\\color{Firmowy}${tytul}}\\par\\nopagebreak[4]\\vspace{0.15em}\\nopagebreak[4]\n{\\color{Firmowy}\\hrule height 0.6pt}\\nopagebreak[4]\\vspace{0.45em}\\nopagebreak[4]\n${czysta}\n`;
}

// Zdjęcie w zaokrąglonej ramce. Zachowuje proporcje (keepaspectratio) i mieści się w podanej szerokości
// oraz wysokości, więc nigdy nie jest rozciągnięte.
function zdjecieZaokraglone(plik: string, szerokosc: string, wysokosc: string) {
  return `\\sbox{\\PudelkoZdjecia}{\\includegraphics[width=${szerokosc},height=${wysokosc},keepaspectratio]{${plik}}}%
\\begin{tikzpicture}[baseline=(current bounding box.north)]
\\begin{scope}
\\clip[rounded corners=2.2mm] (0,0) rectangle (\\the\\wd\\PudelkoZdjecia,\\the\\ht\\PudelkoZdjecia);
\\node[anchor=south west, inner sep=0pt] at (0,0) {\\usebox{\\PudelkoZdjecia}};
\\end{scope}
\\draw[rounded corners=2.2mm, line width=0.6pt, color=BorderGray] (0,0) rectangle (\\the\\wd\\PudelkoZdjecia,\\the\\ht\\PudelkoZdjecia);
\\end{tikzpicture}`;
}

function kolumnaZdjecia(plik: string, podpis: string, szerokosc: string, wysokosc: string, szerokoscZdjecia: string) {
  const opis = podpis.trim() ? `\\\\[0.2cm]\n{\\small ${tex(podpis.trim())}}` : "";
  return `\\begin{minipage}[t]{${szerokosc}}
\\centering
${zdjecieZaokraglone(plik, szerokoscZdjecia, wysokosc)}${opis}
\\end{minipage}`;
}

// Siatka zdjęć: jedno zdjęcie wyśrodkowane, więcej w dwóch kolumnach (równe odstępy, maksymalna
// szerokość i wysokość komórki).
function ukladZdjec(pliki: { plik: string; podpis: string }[]) {
  if (pliki.length === 1) {
    const jedyne = pliki[0];
    return `\\noindent
\\begin{center}
${kolumnaZdjecia(jedyne.plik, jedyne.podpis, "0.78\\textwidth", "8.2cm", "\\linewidth")}
\\end{center}
\\vspace{0.4cm}`;
  }

  const wiersze: string[] = [];
  for (let indeks = 0; indeks < pliki.length; indeks += 2) {
    const lewe = pliki[indeks];
    const prawe = pliki[indeks + 1];
    const lewaRamka = kolumnaZdjecia(lewe.plik, lewe.podpis, "0.48\\textwidth", "7cm", "0.96\\linewidth");
    const prawaRamka = prawe
      ? kolumnaZdjecia(prawe.plik, prawe.podpis, "0.48\\textwidth", "7cm", "0.96\\linewidth")
      : "\\begin{minipage}[t]{0.48\\textwidth}~\\end{minipage}";
    wiersze.push(`\\noindent
${lewaRamka}
\\hfill
${prawaRamka}
\\par
\\vspace{0.5cm}`);
  }
  return wiersze.join("\n");
}

export function trescLatex(
  dane: DaneProtokoluPdf,
  plikiZdjec: { plik: string; podpis: string }[] = [],
  plikPodpisuKlienta = "",
  plikPodpisuSerwisanta = "",
  plikLogo = "",
) {
  const widok = widokProtokolu(dane);
  const logo = plikLogo ? `\\includegraphics[width=\\linewidth,height=2.2cm,keepaspectratio]{${plikLogo}}` : "~";
  const adres = widok.klientLinie.map((linia) => tex(linia)).join("\\\\\n    ");
  const status = widok.statusAwaria
    ? `\\textbf{\\textcolor{StatusErr}{${tex(widok.status)}}}`
    : tex(widok.status);
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
  const blokUrzadzenia = [
    widok.dodatkoweUrzadzenie.length > 0
      ? tabelaPol(widok.dodatkoweUrzadzenie.map(([etykieta, wartosc]) => [etykieta, pole(wartosc)]))
      : "",
    widok.opisUslugi ? `\\noindent ${tex(widok.opisUslugi).replaceAll("\n", "\\\\\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\\vspace{0.25cm}\n");
  // Każda grupa (Pomieszczenie, Instalacje, ...) to osobna tabela: nagłówek z nazwą grupy
  // i kolumną „Status”, a pod nim czynności ze statusem w postaci pola wyboru.
  const blokChecklisty = widok.checklista
    .map((grupa) =>
      tabelaPol(
        grupa.pozycje.map((pozycja): [string, string] => [
          pozycja.etykieta,
          statusChecklisty(pozycja.kodStanu, pozycja.stan),
        ]),
        [grupa.tytul, "Status"],
        true,
      ),
    )
    .join("\n\\par\\vspace{0.5cm}\n");
  const blokPomiarow =
    widok.pomiary.length > 0
      ? tabelaPol(widok.pomiary.map(([etykieta, wartosc]) => [etykieta, pole(wartosc)]))
      : "";
  const zdaniaOswiadczen = [
    widok.oswiadczeniePowierzchni
      ? "Oświadczam, że powierzchnia użytkowa budynku mieszkalnego jednorodzinnego nie przekracza 300 mkw."
      : "",
    widok.powierzchniaDo150
      ? "Oświadczam, że powierzchnia użytkowa lokalu mieszkalnego nie przekracza 150 mkw."
      : "",
  ].filter(Boolean);
  const blokOswiadczenia = zdaniaOswiadczen
    .map((zdanie) => `\\noindent ${tex(zdanie)}\\par`)
    .join("\n\\vspace{0.55em}\n");
  const listaCzynnosci = `\\noindent
\\begin{itemize}[label={}, leftmargin=1.6em]
${pozycjeListy.join("\n")}
    \\item ${kratka(!widok.inneNieDotyczy && Boolean(widok.inneCzynnosci))} Inne: ${inne}\\quad ${kratka(widok.inneNieDotyczy, "Nie dotyczy")}
\\end{itemize}
\\vspace{0.2cm}
\\noindent \\textbf{Data kolejnego przeglądu:} ${kolejny}`;
  // Ramka uwag: delikatne granatowe obramowanie, zaokrąglone rogi i wewnętrzny odstęp. Wpisy serwisanta
  // są pogrubione, bo to ważne informacje o usterkach.
  const poleUwag = "text width=\\dimexpr\\textwidth-8mm-0.8pt\\relax, inner sep=4mm";
  const uwagi = widok.uwagi
    ? `\\noindent\n\\begin{tikzpicture}\n\\node[draw=Firmowy, line width=0.8pt, rounded corners=2.5mm, fill=white, align=left, anchor=north west, ${poleUwag}] {\\textbf{${tex(widok.uwagi).replaceAll("\n", "\\\\\n")}}};\n\\end{tikzpicture}`
    : `\\noindent\n\\begin{tikzpicture}\n\\node[draw=Firmowy, line width=0.8pt, rounded corners=2.5mm, fill=white, align=left, anchor=north west, minimum height=3.4cm, ${poleUwag}] {~};\n\\end{tikzpicture}`;
  const analiza = plikiZdjec.length > 0 ? ukladZdjec(plikiZdjec) : "~";
  const miejscePodpisu = plikPodpisuKlienta
    ? `\\vspace{0.9cm}\\includegraphics[width=5.2cm,height=1.5cm,keepaspectratio]{${plikPodpisuKlienta}}\\\\[-1.5mm]`
    : "\\vspace{2.4cm}";
  const miejscePodpisuSerwisanta = plikPodpisuSerwisanta
    ? `\\vspace{0.9cm}\\includegraphics[width=5.2cm,height=1.5cm,keepaspectratio]{${plikPodpisuSerwisanta}}\\\\[-1.5mm]`
    : "\\vspace{2.4cm}";

  return `\\documentclass[10pt, a4paper]{article}

\\usepackage[a4paper, left=2cm, right=2cm, top=2cm, bottom=2cm]{geometry}
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

\\usepackage{array}
\\usepackage{tabularx}
\\usepackage{booktabs}
\\usepackage[table]{xcolor}
\\usepackage{enumitem}
\\usepackage{graphicx}
\\usepackage{fancyhdr}
\\usepackage{amssymb}
\\usepackage{tikz}
% Zakaz łamania strony tuż przed listą, żeby tytuł sekcji nie został sam na dole strony.
\\makeatletter\\@beginparpenalty=10000\\makeatother
\\setlength{\\parindent}{0pt}
\\setlength{\\tabcolsep}{6pt}

% Pole wyboru (znacznik statusu): kwadrat w podanym kolorze z miejscem na ptaszek.
\\newsavebox{\\PudelkoZdjecia}
\\newcommand{\\PoleWyboru}[2]{\\mbox{\\setlength{\\fboxsep}{0pt}\\setlength{\\fboxrule}{0.7pt}\\fcolorbox{#1}{white}{\\makebox[4mm][c]{\\rule[-1mm]{0pt}{4mm}#2}}}}
\\renewcommand{\\arraystretch}{1.35}

\\definecolor{StatusErr}{HTML}{DC2626}
\\definecolor{BorderGray}{HTML}{CBD5E1}
\\definecolor{Zebra}{HTML}{${kolorZebryHex()}}
% Kolor firmowy (zmieniasz go w src/lib/identyfikacjaWizualna.ts) i jego jasny wariant na tła.
\\definecolor{Firmowy}{HTML}{${kolorFirmowyHex()}}
\\colorlet{FirmowyJasny}{Firmowy!${Math.round(UDZIAL_KOLORU_W_TLE * 100)}}

% Stopka na każdej stronie: cienka linia w kolorze firmowym, wyśrodkowany tekst, numer strony po prawej.
\\setlength{\\headheight}{14pt}
\\pagestyle{fancy}
\\fancyhf{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0.5pt}
\\renewcommand{\\footrule}{{\\color{Firmowy}\\vskip-\\footruleskip\\vskip-\\footrulewidth\\hrule width\\headwidth height\\footrulewidth\\vskip\\footruleskip}}
\\fancyfoot[C]{\\small\\textcolor{Firmowy}{${tex(TEKST_STOPKI)}}}
\\fancyfoot[R]{\\small\\textcolor{gray}{\\thepage}}

\\begin{document}

% Nagłówek: logo | pionowa kreska | imię i nazwisko oraz dane teleadresowe (bez nazwy firmy).
\\noindent
\\begin{minipage}[c]{0.34\\textwidth}
    ${logo}
\\end{minipage}%
\\hspace{0.35cm}%
\\textcolor{Firmowy}{\\rule[-1.05cm]{1.2pt}{2.1cm}}%
\\hspace{0.35cm}%
\\begin{minipage}[c]{0.6\\textwidth}
    \\raggedright
    {\\large\\bfseries\\color{Firmowy}${tex(widok.serwisantNazwa)}}\\\\[0.2cm]
    {\\small ${tex(widok.serwisantAdres)}}\\\\[0.1cm]
    {\\small tel. ${tex(widok.serwisantTelefon)}}\\\\[0.1cm]
    {\\small e-mail: ${tex(widok.serwisantEmail)}}
\\end{minipage}
\\par
\\vspace{0.3cm}
{\\color{Firmowy}\\hrule height 1.5pt}
\\vspace{0.25cm}

\\noindent\\colorbox{FirmowyJasny}{\\parbox{\\dimexpr\\textwidth-2\\fboxsep\\relax}{\\strut\\textbf{Data przeglądu:} ${pole(widok.dataPrzegladu)}\\hfill\\textbf{Nr protokołu:} ${pole(widok.numerProtokolu)}\\strut}}

\\vspace{0.5cm}

\\begin{center}
    {\\LARGE \\textbf{PROTOKÓŁ}}\\\\[0.15cm]
    {\\normalsize ${tex(widok.podtytul)}}
\\end{center}

\\vspace{0.4cm}

\\noindent
\\begin{minipage}[t]{0.48\\textwidth}
    \\textbf{\\color{Firmowy}Serwisant}\\\\
    ${tex(widok.serwisantNazwa)}
\\end{minipage}
\\hfill
\\begin{minipage}[t]{0.48\\textwidth}
    \\textbf{\\color{Firmowy}Klient}\\\\
    ${tex(widok.klientNazwa)}\\\\
    ${adres}
\\end{minipage}

\\vspace{0.6cm}

${sekcja("1. Identyfikacja i ustawienia urządzenia", tabelaPol(identyfikacja))}
${blokUrzadzenia ? sekcja("Urządzenie", blokUrzadzenia) : ""}
${sekcja("2. Test bezpieczeństwa i szczelności", tabelaPol(bezpieczenstwo))}
${blokPomiarow ? sekcja("Pomiary", blokPomiarow) : ""}
${sekcja("3. Lista kontrolna wykonanych czynności", listaCzynnosci)}
${blokChecklisty ? sekcja("Checklista czynności serwisowych", blokChecklisty) : ""}
${sekcja("4. Uwagi serwisanta i zdiagnozowane usterki", uwagi)}
${sekcja("5. Załączniki", analiza)}
${blokOswiadczenia ? sekcja("Oświadczenie", blokOswiadczenia) : ""}
\\vspace{0.8cm}
% Podpisy przypięte do dołu strony (\\vspace* nie jest gubione na początku nowej strony).
\\vspace*{\\fill}
\\noindent
\\begin{minipage}[b]{0.44\\textwidth}
    \\centering
    ${miejscePodpisu}
    \\rule{0.9\\linewidth}{0.4pt}\\\\
    \\vspace{0.2cm}
    {\\small Podpis klienta}
\\end{minipage}%
\\hfill
\\begin{minipage}[b]{0.44\\textwidth}
    \\centering
    ${miejscePodpisuSerwisanta}
    \\rule{0.9\\linewidth}{0.4pt}\\\\
    \\vspace{0.2cm}
    {\\small Podpis i pieczęć serwisanta}
\\end{minipage}

\\end{document}
`;
}

export async function utworzPdfLatex(
  dane: DaneProtokoluPdf,
  logo: LogoPdf = logoWbudowane(),
): Promise<Buffer | null> {
  const katalog = await mkdtemp(join(tmpdir(), "protokol-"));

  try {
    await copyFile(
      join(process.cwd(), "src/lib/fonts/NotoSans-Regular.ttf"),
      join(katalog, "NotoSans-Regular.ttf"),
    );
    const plikLogo = logo.rozszerzenie === "png" ? "logo-firmy.png" : "logo-firmy.jpg";
    await writeFile(join(katalog, plikLogo), logo.dane);

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
      trescLatex(dane, plikiZdjec, plikPodpisu, plikPodpisuSerwisanta, plikLogo),
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
