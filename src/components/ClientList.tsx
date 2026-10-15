"use client";

import { collection, onSnapshot, type DocumentData } from "firebase/firestore";
import { useEffect, useState } from "react";
import { AddProtocolForm } from "@/components/AddProtocolForm";
import { EmptyState } from "@/components/EmptyState";
import { nazwaPlikuPdf } from "@/lib/daneProtokolu";
import { KOLEKCJE } from "@/lib/collections";
import { getDb } from "@/lib/firebase";
import { isFirebaseConfigured } from "@/lib/firebaseConfig";
import { protokolyZDokumentu } from "@/lib/klientDokument";
import type { Klient } from "@/types/klient";
import { ETYKIETY_CZYNNOSCI } from "@/types/protokol";

function tekst(wartosc: unknown) {
  return typeof wartosc === "string" && wartosc.trim() ? wartosc.trim() : "—";
}

function formatujDate(wartosc: string) {
  const dopasowanie = /^(\d{4})-(\d{2})-(\d{2})$/.exec(wartosc);
  if (!dopasowanie) {
    return wartosc || "—";
  }
  return `${dopasowanie[3]}.${dopasowanie[2]}.${dopasowanie[1]}`;
}

function formatujAdres(data: DocumentData) {
  const ulica = typeof data.ulica === "string" ? data.ulica.trim() : "";
  const nrDomu = typeof data.nrDomu === "string" ? data.nrDomu.trim() : "";
  const kodPocztowy = typeof data.kodPocztowy === "string" ? data.kodPocztowy.trim() : "";
  const miasto = typeof data.miasto === "string" ? data.miasto.trim() : "";
  const nowyAdres = [
    [ulica, nrDomu].filter(Boolean).join(" "),
    [kodPocztowy, miasto].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  return nowyAdres || tekst(data.adres);
}

function czasUtworzenia(data: DocumentData) {
  const utworzono = data.utworzono;
  if (utworzono && typeof utworzono.toMillis === "function") {
    return utworzono.toMillis() as number;
  }
  return 0;
}

type KlientNaLiscie = Klient & { sortowanie: number };

function jakoKlient(id: string, data: DocumentData): KlientNaLiscie {
  const utworzono = data.utworzono;
  return {
    id,
    imieNazwisko: tekst(data.imieNazwisko),
    telefon: tekst(data.telefon),
    email: tekst(data.email),
    adres: formatujAdres(data),
    dataOstatniegoPrzegladu: formatujDate(tekst(data.dataOstatniegoPrzegladu)),
    numerKotla: tekst(data.numerKotla),
    nazwaKotla: tekst(data.nazwaKotla),
    protokoly: protokolyZDokumentu(data.protokoly).sort((a, b) =>
      b.dataWypelnienia.localeCompare(a.dataWypelnienia),
    ),
    utworzono:
      utworzono && typeof utworzono.toDate === "function" ? utworzono.toDate().toISOString() : "",
    sortowanie: czasUtworzenia(data),
  };
}

function hrefTelefon(telefon: string) {
  const numer = telefon.replace(/[^\d+]/g, "");
  return numer && telefon !== "—" ? `tel:${numer}` : "";
}

function hrefMapy(adres: string) {
  if (!adres || adres === "—") {
    return "";
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adres)}`;
}

type ClientListProps = {
  opisPustej?: string;
};

export function ClientList({
  opisPustej = "Dodaj klienta formularzem. Pojawi się w tej bazie od razu po zapisie.",
}: ClientListProps) {
  const [klienci, setKlienci] = useState<KlientNaLiscie[] | null>(null);
  const [blad, setBlad] = useState("");
  const [protokolKlientaId, setProtokolKlientaId] = useState<string | null>(null);
  const [pobieraId, setPobieraId] = useState<string | null>(null);
  const [bladPdf, setBladPdf] = useState<{ id: string; tekst: string } | null>(null);
  const skonfigurowane = isFirebaseConfigured();

  async function pobierzPdf(klientId: string, protokolId: string, nazwaRaportu: string) {
    setPobieraId(protokolId);
    setBladPdf(null);

    try {
      const odpowiedz = await fetch("/api/protokol/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ klientId, protokolId }),
      });

      if (!odpowiedz.ok) {
        const wynik = (await odpowiedz.json()) as { blad?: string };
        setBladPdf({ id: protokolId, tekst: wynik.blad || "Nie udało się utworzyć PDF." });
        return;
      }

      const plik = await odpowiedz.blob();
      const url = URL.createObjectURL(plik);
      const link = document.createElement("a");
      link.href = url;
      link.download = nazwaPlikuPdf(nazwaRaportu);
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setBladPdf({ id: protokolId, tekst: "Nie udało się pobrać pliku PDF." });
    } finally {
      setPobieraId(null);
    }
  }

  useEffect(() => {
    if (!skonfigurowane) {
      return;
    }

    const db = getDb();
    if (!db) {
      return;
    }

    return onSnapshot(
      collection(db, KOLEKCJE.klienci),
      (snapshot) => {
        setKlienci(
          snapshot.docs
            .map((dokument) => jakoKlient(dokument.id, dokument.data()))
            .sort((a, b) => b.sortowanie - a.sortowanie),
        );
        setBlad("");
      },
      () => {
        setBlad("Nie udało się wczytać bazy klientów.");
        setKlienci([]);
      },
    );
  }, [skonfigurowane]);

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Baza klientów</h2>
        {klienci ? <p className="text-sm text-slate-500">{klienci.length} klientów</p> : null}
      </div>

      {blad ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {blad}
        </p>
      ) : null}

      {skonfigurowane && !blad && klienci === null ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
          Wczytywanie bazy klientów…
        </p>
      ) : null}

      {klienci && klienci.length === 0 && !blad ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <EmptyState title="Brak klientów" description={opisPustej} />
        </div>
      ) : null}

      {klienci && klienci.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4">
          {klienci.map((klient) => {
            const telefon = hrefTelefon(klient.telefon);
            const mapy = hrefMapy(klient.adres);

            return (
              <li
                key={klient.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
              >
                <p className="text-base font-semibold text-slate-900">{klient.imieNazwisko}</p>
                {klient.email !== "—" ? (
                  <p className="mt-0.5 text-sm text-slate-500">{klient.email}</p>
                ) : null}
                <div className="mt-4 grid gap-2">
                  {telefon ? (
                    <a
                      href={telefon}
                      className="flex min-h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900"
                    >
                      {klient.telefon}
                    </a>
                  ) : null}
                  {mapy ? (
                    <a
                      href={mapy}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900"
                    >
                      {klient.adres}
                    </a>
                  ) : (
                    <p className="text-sm text-slate-700">{klient.adres}</p>
                  )}
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  Kocioł: {klient.numerKotla}
                  {klient.nazwaKotla !== "—" ? ` · ${klient.nazwaKotla}` : ""}
                </p>
                {klient.protokoly.length > 0 ? (
                  <ul className="mt-4 grid gap-2">
                    {klient.protokoly.map((protokol) => (
                      <li
                        key={protokol.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm"
                      >
                        <p className="font-medium text-slate-900">
                          {formatujDate(protokol.dataWypelnienia)} · {protokol.nazwaRaportu}
                        </p>
                        <p className="mt-1 text-slate-600">
                          {ETYKIETY_CZYNNOSCI[protokol.czynnosci]} · {protokol.typKotla} · nr{" "}
                          {protokol.numerSeryjny}
                        </p>
                        <button
                          type="button"
                          onClick={() => pobierzPdf(klient.id, protokol.id, protokol.nazwaRaportu)}
                          disabled={pobieraId === protokol.id}
                          className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:bg-slate-400"
                        >
                          {pobieraId === protokol.id ? "Tworzenie PDF…" : "Pobierz PDF"}
                        </button>
                        {bladPdf?.id === protokol.id ? (
                          <p role="alert" className="mt-2 text-sm text-red-700">
                            {bladPdf.tekst}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <button
                  type="button"
                  onClick={() => setProtokolKlientaId(klient.id)}
                  className="mt-4 rounded-lg border border-slate-900 px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-900 hover:text-white"
                >
                  Dodaj protokół
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {protokolKlientaId ? (
        <AddProtocolForm
          klientId={protokolKlientaId}
          imieNazwisko={
            klienci?.find((klient) => klient.id === protokolKlientaId)?.imieNazwisko ?? "Klient"
          }
          onClose={() => setProtokolKlientaId(null)}
        />
      ) : null}
    </section>
  );
}
