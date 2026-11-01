"use client";

import { KeyboardEvent, useEffect, useId, useRef, useState } from "react";

export type KlientOpcja = {
  id: string;
  nazwa: string;
  adres: string;
  telefon: string;
};

type WyborKlientaProps = {
  klienci: KlientOpcja[];
  wartosc: string;
  onZmiana: (klientId: string) => void;
  laduje?: boolean;
};

export function opisKlienta(klient: KlientOpcja) {
  return klient.adres ? `${klient.nazwa} (${klient.adres})` : klient.nazwa;
}

/** Małe litery bez polskich znaków, żeby "lukasz" znalazło "Łukasz". */
function normalizuj(tekst: string) {
  return tekst
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function slowa(tekst: string) {
  return normalizuj(tekst).split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Wpisane litery mają być początkiem słowa (imienia, nazwiska, adresu, telefonu). Dopiero gdy nikt tak nie pasuje,
 * szukamy fragmentu w środku słowa. Klienci z dopasowaniem w nazwie są wyżej niż z dopasowaniem tylko w adresie.
 */
function filtruj(klienci: KlientOpcja[], fraza: string) {
  const czesci = normalizuj(fraza).split(/\s+/).filter(Boolean);
  if (czesci.length === 0) {
    return klienci;
  }

  const dopasuj = (porownaj: (slowo: string, czesc: string) => boolean) =>
    klienci.filter((klient) => {
      const wszystkie = slowa(`${klient.nazwa} ${klient.adres} ${klient.telefon}`);
      return czesci.every((czesc) => wszystkie.some((slowo) => porownaj(slowo, czesc)));
    });

  let trafienia = dopasuj((slowo, czesc) => slowo.startsWith(czesc));
  if (trafienia.length === 0) {
    trafienia = dopasuj((slowo, czesc) => slowo.includes(czesc));
  }

  const wNazwie = (klient: KlientOpcja) => {
    const slowaNazwy = slowa(klient.nazwa);
    return czesci.every((czesc) => slowaNazwy.some((slowo) => slowo.includes(czesc))) ? 0 : 1;
  };
  return [...trafienia].sort((a, b) => wNazwie(a) - wNazwie(b));
}

export function WyborKlienta({ klienci, wartosc, onZmiana, laduje = false }: WyborKlientaProps) {
  const idPola = useId();
  const idListy = `${idPola}-lista`;
  const [wpisany, setWpisany] = useState<string | null>(null);
  const [otwarta, setOtwarta] = useState(false);
  const [aktywny, setAktywny] = useState(0);
  const aktywnaPozycja = useRef<HTMLLIElement | null>(null);

  const wybrany = klienci.find((klient) => klient.id === wartosc);
  // null = pokazujemy wybranego klienta, tekst = użytkownik właśnie coś wpisuje
  const wartoscPola = wpisany ?? (wybrany ? opisKlienta(wybrany) : "");
  const wyniki = filtruj(klienci, wpisany ?? "");
  const indeksAktywny = Math.min(aktywny, Math.max(wyniki.length - 1, 0));

  useEffect(() => {
    aktywnaPozycja.current?.scrollIntoView({ block: "nearest" });
  }, [indeksAktywny, otwarta, wpisany]);

  function wybierz(klient: KlientOpcja) {
    onZmiana(klient.id);
    setWpisany(null);
    setOtwarta(false);
  }

  function wyczysc() {
    onZmiana("");
    setWpisany("");
    setAktywny(0);
    setOtwarta(true);
  }

  function obsluzKlawisz(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOtwarta(true);
      setAktywny(Math.min(indeksAktywny + 1, Math.max(wyniki.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setAktywny(Math.max(indeksAktywny - 1, 0));
    } else if (event.key === "Enter" && otwarta) {
      // Enter w otwartej liście wybiera klienta, a nie wysyła formularza
      event.preventDefault();
      if (wyniki[indeksAktywny]) {
        wybierz(wyniki[indeksAktywny]);
      }
    } else if (event.key === "Escape") {
      setOtwarta(false);
      setWpisany(null);
    }
  }

  return (
    <div className="relative">
      <label htmlFor={idPola} className="block text-xs font-semibold uppercase text-slate-600">
        Klient
      </label>
      <div className="relative mt-1.5">
        <input
          id={idPola}
          type="text"
          role="combobox"
          aria-expanded={otwarta}
          aria-controls={idListy}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={laduje}
          value={wartoscPola}
          placeholder={
            laduje ? "Ładowanie klientów..." : klienci.length === 0 ? "Brak klientów w bazie" : "Wpisz pierwsze litery imienia lub nazwiska"
          }
          onChange={(e) => {
            setWpisany(e.target.value);
            setAktywny(0);
            setOtwarta(true);
            // zmiana tekstu unieważnia poprzedni wybór, klienta trzeba wybrać z listy
            if (wartosc) {
              onZmiana("");
            }
          }}
          onFocus={() => setOtwarta(true)}
          onBlur={() => {
            setOtwarta(false);
            setWpisany(null);
          }}
          onKeyDown={obsluzKlawisz}
          className="field pr-9 font-normal normal-case text-slate-900"
        />
        {wartoscPola ? (
          <button
            type="button"
            aria-label="Wyczyść wybór klienta"
            onMouseDown={(e) => e.preventDefault()}
            onClick={wyczysc}
            className="absolute inset-y-0 right-0 px-3 text-slate-400 transition-colors hover:text-slate-700"
          >
            ✕
          </button>
        ) : null}
      </div>

      {otwarta && !laduje ? (
        <ul
          id={idListy}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
        >
          {wyniki.length === 0 ? (
            <li className="px-3 py-2 text-slate-500">Nie znaleziono klienta w bazie.</li>
          ) : (
            wyniki.map((klient, indeks) => (
              <li
                key={klient.id}
                ref={indeks === indeksAktywny ? aktywnaPozycja : undefined}
                role="option"
                aria-selected={klient.id === wartosc}
                // mouseDown (nie click), żeby wybór zadziałał zanim pole straci fokus
                onMouseDown={(e) => {
                  e.preventDefault();
                  wybierz(klient);
                }}
                onMouseEnter={() => setAktywny(indeks)}
                className={`cursor-pointer px-3 py-2 ${
                  indeks === indeksAktywny ? "bg-slate-100 text-slate-900" : "text-slate-800"
                } ${klient.id === wartosc ? "font-semibold" : ""}`}
              >
                <span className="block">{klient.nazwa}</span>
                {klient.adres ? <span className="block text-xs text-slate-500">{klient.adres}</span> : null}
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
