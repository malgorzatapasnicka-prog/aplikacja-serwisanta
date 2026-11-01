import { formatujKwote, pozycjeRozliczenia, sumaProtokolu, type KwotyProtokolu } from "@/lib/rozliczenie";

/** Rozwijane rozliczenie przy protokole. Widoczne tylko w panelu serwisanta, nie trafia do PDF. */
export function RozliczenieProtokolu({ protokol }: { protokol: KwotyProtokolu }) {
  const pozycje = pozycjeRozliczenia(protokol);

  if (pozycje.length === 0) {
    return <p className="mt-1 text-xs text-gray-400">Rozliczenie: nie wpisano kwot</p>;
  }

  const suma = sumaProtokolu(protokol);

  return (
    <details className="group mt-1 rounded-lg border border-gray-100 bg-gray-50 text-sm">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs font-medium text-gray-700 marker:hidden [&::-webkit-details-marker]:hidden">
        <span className="inline-block transition-transform group-open:rotate-90" aria-hidden>
          ▸
        </span>
        <span>Rozliczenie (tylko dla serwisanta)</span>
        <span className="ml-auto tabular-nums text-gray-900">Razem brutto: {formatujKwote(suma.brutto)}</span>
      </summary>

      <div className="border-t border-gray-100 px-3 py-2">
        <table className="w-full text-xs">
          <thead className="text-left text-gray-500">
            <tr>
              <th className="py-1 font-semibold">Pozycja</th>
              <th className="py-1 text-right font-semibold">Netto</th>
              <th className="py-1 text-right font-semibold">Brutto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 tabular-nums">
            {pozycje.map((pozycja) => (
              <tr key={pozycja.klucz}>
                <td className="py-1 text-gray-700">{pozycja.nazwa}</td>
                <td className="py-1 text-right text-gray-900">{formatujKwote(pozycja.netto)}</td>
                <td className="py-1 text-right text-gray-900">{formatujKwote(pozycja.brutto)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-1 text-gray-900">Razem</td>
              <td className="py-1 text-right text-gray-900">{formatujKwote(suma.netto)}</td>
              <td className="py-1 text-right text-gray-900">{formatujKwote(suma.brutto)}</td>
            </tr>
          </tbody>
        </table>

        {protokol.opisUslugi?.trim() ? (
          <p className="mt-2 whitespace-pre-line text-xs text-gray-600">
            <span className="font-semibold text-gray-700">Opis usługi: </span>
            {protokol.opisUslugi}
          </p>
        ) : null}
      </div>
    </details>
  );
}
