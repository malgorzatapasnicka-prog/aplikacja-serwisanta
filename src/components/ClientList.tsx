"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Calendar,
  ClipboardList,
  Download,
  FileDown,
  Flame,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Trash2,
  User,
  X,
} from "lucide-react";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { KOLEKCJE } from "@/lib/collections";
import { getDb } from "@/lib/firebase";
import { AddProtocolForm } from "@/components/AddProtocolForm";

type Protokol = {
  id: string;
  nazwaRaportu: string;
  czynnosci: string;
  status?: string;
  typKotla?: string;
  mocNominalna?: string;
  sterownik?: string;
  numerSeryjny?: string;
  grzanie?: string;
  maksymalnaTemperaturaZasilania?: string;
  zdjecia?: string[];
  dataWypelnienia: string;
  numerProtokolu?: string;
};

type KlientDokument = {
  id: string;
  imie?: string;
  nazwisko?: string;
  imieNazwisko?: string;
  telefon?: string;
  email?: string;
  adres?: string;
  dataOstatniegoPrzegladu?: string;
  numerKotla?: string;
  numeryKotlow?: string[];
  nazwaKotla?: string;
  protokoly?: Protokol[];
};

function KomorkaDanych({
  etykieta,
  wartosc,
  ikona,
}: {
  etykieta: string;
  wartosc?: string;
  ikona?: ReactNode;
}) {
  if (!wartosc || wartosc.trim() === "") return null;

  return (
    <div className="flex gap-3">
      {ikona ? <span className="mt-0.5 text-gray-400">{ikona}</span> : null}
      <div className="min-w-0">
        <span className="text-xs font-semibold uppercase text-gray-500">{etykieta}</span>
        <span className="mt-1 block break-words text-sm font-medium text-gray-900">{wartosc}</span>
      </div>
    </div>
  );
}

function numeryKotlowKlienta(klient: { numerKotla?: string; numeryKotlow?: unknown }) {
  if (Array.isArray(klient.numeryKotlow)) {
    const lista = klient.numeryKotlow
      .filter((wartosc): wartosc is string => typeof wartosc === "string")
      .map((wartosc) => wartosc.trim())
      .slice(0, 5);
    while (lista.length > 0 && lista[lista.length - 1] === "") {
      lista.pop();
    }
    if (lista.length > 0) {
      return lista;
    }
  }

  const jeden = (klient.numerKotla || "").trim();
  return jeden ? [jeden] : [];
}

export function ClientList({ opisPustej }: { opisPustej?: string }) {
  const [klienci, setKlienci] = useState<KlientDokument[]>([]);
  const [laduje, setLaduje] = useState(true);
  const [szukaj, setSzukaj] = useState("");

  // Stan edycji klienta
  const [edytowanyId, setEdytowanyId] = useState<string | null>(null);
  const [formEdycji, setFormEdycji] = useState<KlientDokument | null>(null);
  const [zapisujeEdycje, setZapisujeEdycje] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  // Stan modala protokołu oraz pobierania PDF
  const [protokolKlient, setProtokolKlient] = useState<KlientDokument | null>(null);
  const [pobieramPdfId, setPobieramPdfId] = useState<string | null>(null);
  const [wysylamEmailId, setWysylamEmailId] = useState<string | null>(null);

  useEffect(() => {
    const db = getDb();
    if (!db) {
      setLaduje(false);
      return;
    }

    const q = query(
      collection(db, KOLEKCJE.klienci),
      orderBy("utworzono", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const lista: KlientDokument[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setKlienci(lista);
        setLaduje(false);
      },
      (err) => {
        console.error("Błąd pobierania klientów:", err);
        setLaduje(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const pobierzImie = (k: KlientDokument) => {
    if (k.imie && k.imie.trim() !== "") return k.imie;
    if (k.imieNazwisko) {
      const czesci = k.imieNazwisko.trim().split(" ");
      return czesci[0] || "";
    }
    return "";
  };

  const pobierzNazwisko = (k: KlientDokument) => {
    if (k.nazwisko && k.nazwisko.trim() !== "") return k.nazwisko;
    if (k.imieNazwisko) {
      const czesci = k.imieNazwisko.trim().split(" ");
      return czesci.slice(1).join(" ") || "";
    }
    return "";
  };

  // Eksport bazy do CSV z UTF-8 BOM
  const handleEksportCSV = () => {
    if (klienci.length === 0) {
      alert("Baza klientów jest pusta.");
      return;
    }

    const naglowki = [
      "ID",
      "Imię",
      "Nazwisko",
      "Telefon",
      "E-mail",
      "Adres",
      "Numer kotła",
      "Data ostatniego przeglądu",
    ];

    const wiersze = klienci.map((k) => [
      `"${(k.id || "").replace(/"/g, '""')}"`,
      `"${pobierzImie(k).replace(/"/g, '""')}"`,
      `"${pobierzNazwisko(k).replace(/"/g, '""')}"`,
      `"${(k.telefon || "").replace(/"/g, '""')}"`,
      `"${(k.email || "").replace(/"/g, '""')}"`,
      `"${(k.adres || "").replace(/"/g, '""')}"`,
      `"${(k.numerKotla || "").replace(/"/g, '""')}"`,
      `"${(k.dataOstatniegoPrzegladu || "").replace(/"/g, '""')}"`,
    ]);

    const zawartoscCSV =
      "\uFEFF" +
      [naglowki.join(";"), ...wiersze.map((w) => w.join(";"))].join("\r\n");

    const blob = new Blob([zawartoscCSV], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dzisiejszaData = new Date().toISOString().split("T")[0];

    link.setAttribute("href", url);
    link.setAttribute("download", `baza_klientow_${dzisiejszaData}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Pobieranie PDF metodą POST do /api/protokol/pdf
  const handlePobierzPdf = async (
    klientId: string,
    protokolId: string,
    nazwaRaportu: string
  ) => {
    try {
      setPobieramPdfId(protokolId);

      const res = await fetch("/api/protokol/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ klientId, protokolId }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.blad || `Błąd pobierania (${res.status})`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${nazwaRaportu || "protokol"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Nie udało się pobrać PDF.";
      alert(msg);
    } finally {
      setPobieramPdfId(null);
    }
  };

  const handleWyslijEmail = async (klient: KlientDokument, protokolId: string, nazwaRaportu: string) => {
    const db = getDb();
    if (!db) {
      return;
    }

    let adres = klient.email?.trim() || "";
    if (!adres) {
      const podany = window.prompt("Podaj adres e-mail klienta, na który wysłać raport:");
      if (podany === null) {
        return;
      }
      adres = podany.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adres)) {
        alert("Podaj prawidłowy adres e-mail.");
        return;
      }
      try {
        await updateDoc(doc(db, KOLEKCJE.klienci, klient.id), { email: adres });
      } catch (err) {
        console.error("Błąd zapisu adresu e-mail:", err);
        alert("Nie udało się zapisać adresu e-mail klienta.");
        return;
      }
    }

    try {
      setWysylamEmailId(protokolId);

      const res = await fetch("/api/protokol/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ klientId: klient.id, protokolId }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.blad || `Błąd pobierania (${res.status})`);
      }

      const bajty = new Uint8Array(await res.arrayBuffer());
      let binarny = "";
      for (let i = 0; i < bajty.length; i += 0x8000) {
        binarny += String.fromCharCode(...bajty.subarray(i, i + 0x8000));
      }

      const wysylka = await fetch("/api/send-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: adres,
          pdfBase64: btoa(binarny),
          nazwaRaportu,
        }),
      });

      if (!wysylka.ok) {
        const errData = await wysylka.json().catch(() => ({}));
        throw new Error(errData.blad || `Błąd wysyłki (${wysylka.status})`);
      }

      alert(`Raport został wysłany na adres ${adres}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Nie udało się wysłać raportu.";
      alert(msg);
    } finally {
      setWysylamEmailId(null);
    }
  };

  // Usuwanie całego klienta
  const handleUsun = async (id: string, nazwa?: string) => {
    const potwierdzenie = window.confirm(
      `Czy na pewno chcesz bezpowrotnie usunąć klienta: ${nazwa || "bez nazwy"}?`
    );
    if (!potwierdzenie) return;

    const db = getDb();
    if (!db) return;

    try {
      await deleteDoc(doc(db, KOLEKCJE.klienci, id));
      const protokoly = klienci.find((klient) => klient.id === id)?.protokoly ?? [];
      await Promise.all(
        protokoly.map((protokol) =>
          deleteDoc(doc(db, KOLEKCJE.zalacznikiProtokolu, protokol.id)).catch(() => undefined),
        ),
      );
    } catch (err) {
      console.error("Błąd podczas usuwania klienta:", err);
      alert("Nie udało się usunąć klienta. Sprawdź uprawnienia w Firestore.");
    }
  };

  // Usuwanie konkretnego raportu/protokołu
  const handleUsunProtokol = async (
    klientId: string,
    protokolId: string,
    nazwaRaportu: string
  ) => {
    const potwierdzenie = window.confirm(
      `Czy na pewno chcesz usunąć raport "${nazwaRaportu}"?`
    );
    if (!potwierdzenie) return;

    const db = getDb();
    if (!db) return;

    try {
      const klient = klienci.find((k) => k.id === klientId);
      if (!klient || !klient.protokoly) return;

      const zaktualizowaneProtokoly = klient.protokoly.filter((p) => p.id !== protokolId);

      await updateDoc(doc(db, KOLEKCJE.klienci, klientId), {
        protokoly: zaktualizowaneProtokoly,
      });
      await deleteDoc(doc(db, KOLEKCJE.zalacznikiProtokolu, protokolId)).catch(() => undefined);
    } catch (err) {
      console.error("Błąd usuwania protokołu:", err);
      alert("Nie udało się usunąć protokołu.");
    }
  };

  const handleStartEdycja = (klient: KlientDokument) => {
    setEdytowanyId(klient.id);
    setFormEdycji({
      ...klient,
      imie: pobierzImie(klient),
      nazwisko: pobierzNazwisko(klient),
      numeryKotlow: numeryKotlowKlienta(klient).length > 0 ? numeryKotlowKlienta(klient) : [""],
    });
    setBlad(null);
  };

  const handleAnulujEdycje = () => {
    setEdytowanyId(null);
    setFormEdycji(null);
    setBlad(null);
  };

  const handleZapiszEdycje = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edytowanyId || !formEdycji) return;

    const db = getDb();
    if (!db) return;

    setZapisujeEdycje(true);
    setBlad(null);

    try {
      const docRef = doc(db, KOLEKCJE.klienci, edytowanyId);
      const imieTrim = formEdycji.imie?.trim() || "";
      const nazwiskoTrim = formEdycji.nazwisko?.trim() || "";

      const numeryKotlow = (formEdycji.numeryKotlow || [formEdycji.numerKotla || ""])
        .map((numer) => numer.trim())
        .slice(0, 5);
      while (numeryKotlow.length > 0 && numeryKotlow[numeryKotlow.length - 1] === "") {
        numeryKotlow.pop();
      }

      await updateDoc(docRef, {
        imie: imieTrim,
        nazwisko: nazwiskoTrim,
        imieNazwisko: `${imieTrim} ${nazwiskoTrim}`.trim(),
        telefon: formEdycji.telefon?.trim() || "",
        email: formEdycji.email?.trim() || "",
        adres: formEdycji.adres?.trim() || "",
        dataOstatniegoPrzegladu: formEdycji.dataOstatniegoPrzegladu || "",
        numeryKotlow,
        numerKotla: numeryKotlow.find((numer) => numer !== "") || "",
      });
      setEdytowanyId(null);
      setFormEdycji(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Błąd zapisu edycji.";
      setBlad(msg);
    } finally {
      setZapisujeEdycje(false);
    }
  };

  if (laduje) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500 shadow-sm">
        Ładowanie listy klientów...
      </div>
    );
  }

  if (klienci.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
        {opisPustej || "Brak zapisanych klientów w bazie."}
      </div>
    );
  }

  const przefiltrowani = klienci.filter((k) => {
    const q = szukaj.toLowerCase();
    const imie = pobierzImie(k).toLowerCase();
    const nazwisko = pobierzNazwisko(k).toLowerCase();
    const calosc = `${imie} ${nazwisko}`;

    return (
      calosc.includes(q) ||
      (k.telefon || "").toLowerCase().includes(q) ||
      (k.adres || "").toLowerCase().includes(q) ||
      numeryKotlowKlienta(k).some((numer) => numer.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      {/* Pasek narzędzi: Wyszukiwarka + CSV */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <input
          type="text"
          value={szukaj}
          onChange={(e) => setSzukaj(e.target.value)}
          placeholder="Szukaj klienta (imię, nazwisko, telefon, adres, numer kotła)..."
          className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition focus:border-gray-400"
        />
        <button
          type="button"
          onClick={handleEksportCSV}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
          title="Pobierz bazę do arkusza kalkulacyjnego"
        >
          <Download className="h-4 w-4 text-gray-400" aria-hidden />
          Pobierz CSV
        </button>
      </div>

      {/* Lista kafelków */}
      <div className="space-y-4">
        {przefiltrowani.map((klient) => {
          const imie = pobierzImie(klient);
          const nazwisko = pobierzNazwisko(klient);
          const pelnaNazwa = `${imie} ${nazwisko}`.trim() || "Klient bez nazwy";
          const czyEdytowany = edytowanyId === klient.id;

          if (czyEdytowany && formEdycji) {
            return (
              <form
                key={klient.id}
                onSubmit={handleZapiszEdycje}
                className="space-y-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">
                    Edycja danych klienta
                  </span>
                  {blad && <span className="text-xs text-red-600">{blad}</span>}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                  <div>
                    <label className="text-xs font-semibold uppercase text-gray-500">
                      Imię
                    </label>
                    <input
                      type="text"
                      value={formEdycji.imie || ""}
                      onChange={(e) =>
                        setFormEdycji({ ...formEdycji, imie: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase text-gray-500">
                      Nazwisko
                    </label>
                    <input
                      type="text"
                      value={formEdycji.nazwisko || ""}
                      onChange={(e) =>
                        setFormEdycji({ ...formEdycji, nazwisko: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase text-gray-500">
                      Telefon
                    </label>
                    <input
                      type="tel"
                      value={formEdycji.telefon || ""}
                      onChange={(e) =>
                        setFormEdycji({ ...formEdycji, telefon: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase text-gray-500">
                      E-mail
                    </label>
                    <input
                      type="email"
                      value={formEdycji.email || ""}
                      onChange={(e) =>
                        setFormEdycji({ ...formEdycji, email: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold uppercase text-gray-500">
                      Adres
                    </label>
                    <input
                      type="text"
                      value={formEdycji.adres || ""}
                      onChange={(e) =>
                        setFormEdycji({ ...formEdycji, adres: e.target.value })
                      }
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                    />
                  </div>

                  {(formEdycji.numeryKotlow || [formEdycji.numerKotla || ""]).map((numer, indeks) => (
                    <div key={indeks}>
                      <label className="text-xs font-semibold uppercase text-gray-500">
                        Numer kotła {indeks + 1}
                      </label>
                      <input
                        type="text"
                        value={numer}
                        onChange={(e) => {
                          const numeryKotlow = [...(formEdycji.numeryKotlow || [formEdycji.numerKotla || ""])];
                          numeryKotlow[indeks] = e.target.value;
                          setFormEdycji({ ...formEdycji, numeryKotlow });
                        }}
                        className="mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                      />
                    </div>
                  ))}

                  {(formEdycji.numeryKotlow || [formEdycji.numerKotla || ""]).length < 5 ? (
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() =>
                          setFormEdycji({
                            ...formEdycji,
                            numeryKotlow: [...(formEdycji.numeryKotlow || [formEdycji.numerKotla || ""]), ""],
                          })
                        }
                        className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Dodaj kolejny kocioł
                      </button>
                    </div>
                  ) : null}

                  <div>
                    <label className="text-xs font-semibold uppercase text-gray-500">
                      Data ostatniego przeglądu
                    </label>
                    <input
                      type="date"
                      value={formEdycji.dataOstatniegoPrzegladu || ""}
                      onChange={(e) =>
                        setFormEdycji({
                          ...formEdycji,
                          dataOstatniegoPrzegladu: e.target.value,
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white p-2 text-sm text-gray-900 outline-none focus:border-gray-400"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={handleAnulujEdycje}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={zapisujeEdycje}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {zapisujeEdycje ? "Zapisywanie..." : "Zapisz zmiany"}
                  </button>
                </div>
              </form>
            );
          }

          return (
            <div
              key={klient.id}
              className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  {pelnaNazwa}
                </h3>

                <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setProtokolKlient(klient)}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                  >
                    <ClipboardList className="h-4 w-4" aria-hidden />
                    Raport z wizyty
                  </button>
                  <button
                    type="button"
                    disabled={wysylamEmailId !== null && wysylamEmailId === klient.protokoly?.[klient.protokoly.length - 1]?.id}
                    onClick={() => {
                      const ostatni = klient.protokoly?.[klient.protokoly.length - 1];
                      if (!ostatni) {
                        alert("Najpierw zapisz raport z wizyty. Potem można wysłać go na e-mail.");
                        return;
                      }
                      handleWyslijEmail(klient, ostatni.id, ostatni.nazwaRaportu);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Mail className="h-4 w-4 text-gray-400" aria-hidden />
                    Wyślij na e-mail
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartEdycja(klient)}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Pencil className="h-4 w-4 text-gray-400" aria-hidden />
                    Edytuj
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUsun(klient.id, pelnaNazwa)}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <Trash2 className="h-4 w-4 text-gray-400" aria-hidden />
                    Usuń
                  </button>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                <KomorkaDanych etykieta="Imię" wartosc={imie} ikona={<User className="h-4 w-4" aria-hidden />} />
                <KomorkaDanych etykieta="Nazwisko" wartosc={nazwisko} ikona={<User className="h-4 w-4" aria-hidden />} />
                <KomorkaDanych etykieta="Telefon" wartosc={klient.telefon} ikona={<Phone className="h-4 w-4" aria-hidden />} />
                <KomorkaDanych etykieta="E-mail" wartosc={klient.email} ikona={<Mail className="h-4 w-4" aria-hidden />} />
                <KomorkaDanych etykieta="Adres" wartosc={klient.adres} ikona={<MapPin className="h-4 w-4" aria-hidden />} />
                {numeryKotlowKlienta(klient).map((numer, indeks) =>
                  numer ? (
                    <KomorkaDanych
                      key={`${klient.id}-kociol-${indeks}`}
                      etykieta={`Numer kotła ${indeks + 1}`}
                      wartosc={numer}
                      ikona={<Flame className="h-4 w-4" aria-hidden />}
                    />
                  ) : null,
                )}
                <KomorkaDanych
                  etykieta="Data ostatniego przeglądu"
                  wartosc={klient.dataOstatniegoPrzegladu}
                  ikona={<Calendar className="h-4 w-4" aria-hidden />}
                />
              </div>

              {/* Lista wystawionych raportów z wizyty / protokołów */}
              {klient.protokoly && klient.protokoly.length > 0 && (
                <div className="mt-5">
                  <span className="text-xs font-semibold uppercase text-gray-500">
                    Wystawione protokoły ({klient.protokoly.length}):
                  </span>
                  <div className="mt-3 space-y-3">
                    {klient.protokoly.map((protokol) => (
                      <div
                        key={protokol.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <div>
                          <strong className="font-medium text-gray-900">{protokol.nazwaRaportu}</strong>
                          <span className="ml-2 text-gray-500">({protokol.dataWypelnienia})</span>
                          <span className="ml-2 text-sm font-medium text-gray-900">
                            {protokol.czynnosci}
                          </span>
                        </div>

                        <div className="ml-auto flex items-center gap-3">
                          <button
                            type="button"
                            disabled={pobieramPdfId === protokol.id}
                            onClick={() =>
                              handlePobierzPdf(
                                klient.id,
                                protokol.id,
                                protokol.nazwaRaportu
                              )
                            }
                            className="inline-flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-gray-700 disabled:opacity-50"
                          >
                            <FileDown className="h-4 w-4 text-gray-400" aria-hidden />
                            {pobieramPdfId === protokol.id
                              ? "Generowanie..."
                              : "Pobierz PDF"}
                          </button>
                          <button
                            type="button"
                            disabled={wysylamEmailId === protokol.id}
                            onClick={() =>
                              handleWyslijEmail(klient, protokol.id, protokol.nazwaRaportu)
                            }
                            className="inline-flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-gray-700 disabled:opacity-50"
                          >
                            <Mail className="h-4 w-4 text-gray-400" aria-hidden />
                            {wysylamEmailId === protokol.id ? "Wysyłanie..." : "Wyślij na e-mail"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleUsunProtokol(
                                klient.id,
                                protokol.id,
                                protokol.nazwaRaportu
                              )
                            }
                            className="rounded p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                            title="Usuń ten raport"
                          >
                            <X className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {przefiltrowani.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
            Brak klientów pasujących do frazy &quot;{szukaj}&quot;.
          </div>
        )}
      </div>

      {/* Modal dodawania nowego protokołu z wizyty */}
      {protokolKlient && (
        <AddProtocolForm
          klientId={protokolKlient.id}
          imieNazwisko={`${pobierzImie(protokolKlient)} ${pobierzNazwisko(
            protokolKlient
          )}`.trim()}
          numerKotla={protokolKlient.numerKotla}
          nazwaKotla={protokolKlient.nazwaKotla}
          numeryProtokolow={klienci.flatMap((klient) =>
            (klient.protokoly ?? []).map((protokol) => protokol.numerProtokolu ?? ""),
          )}
          onClose={() => setProtokolKlient(null)}
        />
      )}
    </div>
  );
}