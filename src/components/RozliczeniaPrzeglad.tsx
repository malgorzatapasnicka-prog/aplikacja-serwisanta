"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import {
  POZYCJE_ROZLICZENIA,
  formatujKwote,
  maRozliczenie,
  sumaProtokolu,
  sumujKwoty,
  wszystkiePozycje,
} from "@/lib/rozliczenie";
import { useProtokolyKlientow } from "@/lib/useProtokolyKlientow";
import { ETYKIETY_CZYNNOSCI } from "@/types/protokol";

type Okres = "ten-miesiac" | "poprzedni-miesiac" | "ten-rok" | "wlasny" | "wszystko";

const OPCJE_OKRESU: ReadonlyArray<{ wartosc: Okres; etykieta: string }> = [
  { wartosc: "ten-miesiac", etykieta: "Ten miesiąc" },
  { wartosc: "poprzedni-miesiac", etykieta: "Poprzedni miesiąc" },
  { wartosc: "ten-rok", etykieta: "Ten rok" },
  { wartosc: "wlasny", etykieta: "Własny zakres dat" },
  { wartosc: "wszystko", etykieta: "Cały czas" },
];

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function iso(data: Date) {
  const rok = data.getFullYear();
  const miesiac = String(data.getMonth() + 1).padStart(2, "0");
  const dzien = String(data.getDate()).padStart(2, "0");
  return `${rok}-${miesiac}-${dzien}`;
}

/** Granice okresu jako daty ISO (RRRR-MM-DD). Pusty tekst = brak ograniczenia z tej strony. */
function zakresOkresu(okres: Okres, wlasnyOd: string, wlasnyDo: string) {
  const dzis = new Date();
  const rok = dzis.getFullYear();
  const miesiac = dzis.getMonth();

  switch (okres) {
    case "ten-miesiac":
      return { od: iso(new Date(rok, miesiac, 1)), do: iso(new Date(rok, miesiac + 1, 0)) };
    case "poprzedni-miesiac":
      return { od: iso(new Date(rok, miesiac - 1, 1)), do: iso(new Date(rok, miesiac, 0)) };
    case "ten-rok":
      return { od: `${rok}-01-01`, do: `${rok}-12-31` };
    case "wlasny":
      return { od: wlasnyOd, do: wlasnyDo };
    default:
      return { od: "", do: "" };
  }
}

function dataPolska(wartosc: string) {
  const dopasowanie = /^(\d{4})-(\d{2})-(\d{2})$/.exec(wartosc);
  return dopasowanie ? `${dopasowanie[3]}.${dopasowanie[2]}.${dopasowanie[1]}` : wartosc || "—";
}

function opisZakresu(od: string, doDaty: string) {
  if (!od && !doDaty) {
    return "Wszystkie protokoły";
  }
  if (od && doDaty) {
    return `${dataPolska(od)} – ${dataPolska(doDaty)}`;
  }
  return od ? `od ${dataPolska(od)}` : `do ${dataPolska(doDaty)}`;
}

function liczbaCsv(kwota: number | undefined) {
  return kwota === undefined ? "" : kwota.toFixed(2).replace(".", ",");
}

function poleCsv(wartosc: string) {
  return `"${wartosc.replace(/\s*[\r\n]+\s*/g, " ").replaceAll('"', '""')}"`;
}

export function RozliczeniaPrzeglad() {
  const { wiersze, laduje, blad } = useProtokolyKlientow();
  const [okres, setOkres] = useState<Okres>("ten-miesiac");
  const [wlasnyOd, setWlasnyOd] = useState("");
  const [wlasnyDo, setWlasnyDo] = useState("");

  const zakres = zakresOkresu(okres, wlasnyOd, wlasnyDo);

  const wOkresie = useMemo(
    () =>
      wiersze
        .filter(({ protokol }) => {
          if (!zakres.od && !zakres.do) {
            return true;
          }
          const data = protokol.dataWypelnienia;
          if (!DATA_ISO.test(data)) {
            return false;
          }
          return (!zakres.od || data >= zakres.od) && (!zakres.do || data <= zakres.do);
        })
        .sort(
          (a, b) =>
            (b.protokol.dataWypelnienia || "").localeCompare(a.protokol.dataWypelnienia || "") ||
            a.klientNazwa.localeCompare(b.klientNazwa, "pl"),
        ),
    [wiersze, zakres.od, zakres.do],
  );

  const zRozliczeniem = wOkresie.filter(({ protokol }) => maRozliczenie(protokol));
  const bezRozliczenia = wOkresie.length - zRozliczeniem.length;

  const sumyKategorii = POZYCJE_ROZLICZENIA.map(({ klucz, nazwa }) => {
    const pozycje = zRozliczeniem.map(({ protokol }) => wszystkiePozycje(protokol).find((p) => p.klucz === klucz));
    return {
      nazwa,
      netto: sumujKwoty(pozycje.map((p) => p?.netto)),
      brutto: sumujKwoty(pozycje.map((p) => p?.brutto)),
    };
  });
  const sumaNetto = sumujKwoty(sumyKategorii.map((kategoria) => kategoria.netto));
  const sumaBrutto = sumujKwoty(sumyKategorii.map((kategoria) => kategoria.brutto));

  function pobierzCsv() {
    const naglowki = [
      "Data",
      "Klient",
      "Nr protokołu",
      "Nazwa raportu",
      "Czynność",
      "Usługa netto",
      "Usługa brutto",
      "Dojazd netto",
      "Dojazd brutto",
      "Części/Materiały netto",
      "Części/Materiały brutto",
      "Razem netto",
      "Razem brutto",
      "Opis usługi",
    ];
    const dane = zRozliczeniem.map(({ klientNazwa, protokol }) => {
      const pozycje = wszystkiePozycje(protokol);
      const suma = sumaProtokolu(protokol);
      return [
        poleCsv(dataPolska(protokol.dataWypelnienia)),
        poleCsv(klientNazwa),
        poleCsv(protokol.numerProtokolu ?? ""),
        poleCsv(protokol.nazwaRaportu),
        poleCsv(ETYKIETY_CZYNNOSCI[protokol.czynnosci] ?? ""),
        ...pozycje.flatMap((pozycja) => [liczbaCsv(pozycja.netto), liczbaCsv(pozycja.brutto)]),
        liczbaCsv(suma.netto),
        liczbaCsv(suma.brutto),
        poleCsv(protokol.opisUslugi ?? ""),
      ];
    });
    const zawartosc = "\uFEFF" + [naglowki.map(poleCsv).join(";"), ...dane.map((wiersz) => wiersz.join(";"))].join("\r\n");
    const url = URL.createObjectURL(new Blob([zawartosc], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `rozliczenia_${zakres.od || "poczatek"}_${zakres.do || "dzis"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="block text-xs font-semibold uppercase text-slate-600">
            Okres
            <select
              value={okres}
              onChange={(e) => setOkres(e.target.value as Okres)}
              className="field mt-1 block font-normal normal-case sm:w-56"
            >
              {OPCJE_OKRESU.map((opcja) => (
                <option key={opcja.wartosc} value={opcja.wartosc}>
                  {opcja.etykieta}
                </option>
              ))}
            </select>
          </label>

          {okres === "wlasny" && (
            <>
              <label className="block text-xs font-semibold uppercase text-slate-600">
                Od
                <input
                  type="date"
                  value={wlasnyOd}
                  max={wlasnyDo || undefined}
                  onChange={(e) => setWlasnyOd(e.target.value)}
                  className="field mt-1 block font-normal"
                />
              </label>
              <label className="block text-xs font-semibold uppercase text-slate-600">
                Do
                <input
                  type="date"
                  value={wlasnyDo}
                  min={wlasnyOd || undefined}
                  onChange={(e) => setWlasnyDo(e.target.value)}
                  className="field mt-1 block font-normal"
                />
              </label>
            </>
          )}

          <button
            type="button"
            onClick={pobierzCsv}
            disabled={zRozliczeniem.length === 0}
            className="btn btn-outline sm:ml-auto"
            title="Pobierz zestawienie do arkusza kalkulacyjnego"
          >
            <Download className="h-4 w-4 text-slate-400" aria-hidden />
            Pobierz CSV
          </button>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Okres: <strong className="font-semibold text-slate-900">{opisZakresu(zakres.od, zakres.do)}</strong>
        </p>
      </div>

      {blad && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{blad}</div>}

      {laduje ? (
        <div className="card text-center text-sm text-slate-500">
          Ładowanie rozliczeń...
        </div>
      ) : (
        <>
          <section className="grid gap-6 sm:grid-cols-3">
            <div className="card">
              <p className="text-xs font-semibold uppercase text-slate-500">Suma netto</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{formatujKwote(sumaNetto)}</p>
            </div>
            <div className="card">
              <p className="text-xs font-semibold uppercase text-slate-500">Suma brutto</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{formatujKwote(sumaBrutto)}</p>
            </div>
            <div className="card">
              <p className="text-xs font-semibold uppercase text-slate-500">Protokoły z rozliczeniem</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                {zRozliczeniem.length}
                <span className="ml-1 text-base font-normal text-slate-500">z {wOkresie.length}</span>
              </p>
              {bezRozliczenia > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  {bezRozliczenia} bez wpisanych kwot (nie wliczone do sum)
                </p>
              )}
            </div>
          </section>

          <section className="card overflow-hidden p-0">
            <h2 className="border-b border-slate-100 px-6 py-4 text-sm font-semibold text-slate-900">
              Sumy według rodzaju
            </h2>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-2 font-semibold">Pozycja</th>
                  <th className="px-6 py-2 text-right font-semibold">Netto</th>
                  <th className="px-6 py-2 text-right font-semibold">Brutto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sumyKategorii.map((kategoria) => (
                  <tr key={kategoria.nazwa}>
                    <td className="px-6 py-2.5 text-slate-700">{kategoria.nazwa}</td>
                    <td className="px-6 py-2.5 text-right tabular-nums text-slate-900">
                      {formatujKwote(kategoria.netto)}
                    </td>
                    <td className="px-6 py-2.5 text-right tabular-nums text-slate-900">
                      {formatujKwote(kategoria.brutto)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-6 py-2.5 text-slate-900">Razem</td>
                  <td className="px-6 py-2.5 text-right tabular-nums text-slate-900">{formatujKwote(sumaNetto)}</td>
                  <td className="px-6 py-2.5 text-right tabular-nums text-slate-900">{formatujKwote(sumaBrutto)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="card p-0">
            <h2 className="border-b border-slate-100 px-6 py-4 text-sm font-semibold text-slate-900">
              Protokoły w okresie ({zRozliczeniem.length})
            </h2>
            {zRozliczeniem.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">
                Brak protokołów z wpisanym rozliczeniem w wybranym okresie.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[56rem] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Data</th>
                      <th className="px-4 py-2 font-semibold">Klient</th>
                      <th className="px-4 py-2 font-semibold">Protokół</th>
                      {POZYCJE_ROZLICZENIA.map((pozycja) => (
                        <th key={pozycja.klucz} className="px-4 py-2 text-right font-semibold">
                          {pozycja.nazwa}
                        </th>
                      ))}
                      <th className="px-4 py-2 text-right font-semibold">Razem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 align-top">
                    {zRozliczeniem.map(({ klientId, klientNazwa, protokol }) => {
                      const suma = sumaProtokolu(protokol);
                      return (
                        <tr key={`${klientId}-${protokol.id}`}>
                          <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                            {dataPolska(protokol.dataWypelnienia)}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">{klientNazwa}</td>
                          <td className="px-4 py-3 text-slate-700">
                            {protokol.nazwaRaportu}
                            {protokol.numerProtokolu ? (
                              <span className="block text-xs text-slate-500">{protokol.numerProtokolu}</span>
                            ) : null}
                          </td>
                          {wszystkiePozycje(protokol).map((pozycja) => (
                            <td key={pozycja.klucz} className="px-4 py-3 text-right tabular-nums">
                              {pozycja.netto === undefined && pozycja.brutto === undefined ? (
                                <span className="text-slate-300">—</span>
                              ) : (
                                <>
                                  <span className="block font-medium text-slate-900">
                                    {formatujKwote(pozycja.brutto)}
                                  </span>
                                  <span className="block text-xs text-slate-500">
                                    netto {formatujKwote(pozycja.netto)}
                                  </span>
                                </>
                              )}
                            </td>
                          ))}
                          <td className="px-4 py-3 text-right tabular-nums">
                            <span className="block font-semibold text-slate-900">{formatujKwote(suma.brutto)}</span>
                            <span className="block text-xs text-slate-500">netto {formatujKwote(suma.netto)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <p className="text-xs text-slate-500">
        Rozliczenie jest widoczne tylko dla serwisanta. Nie jest drukowane w PDF-ie ani w kopii protokołu dla klienta.
      </p>
    </div>
  );
}
