"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { KOLEKCJE } from "@/lib/collections";
import { getDb, gdySesjaAktywna } from "@/lib/firebase";

type KlientOpcja = {
  id: string;
  imie?: string;
  nazwisko?: string;
  imieNazwisko?: string;
  telefon?: string;
  adres?: string;
  numerKotla?: string;
};

export function AddOrderForm() {
  const [trybKlienta, setTrybKlienta] = useState<"istniejacy" | "nowy">("istniejacy");
  const [klienci, setKlienci] = useState<KlientOpcja[]>([]);
  const [wybranyKlientId, setWybranyKlientId] = useState("");

  // Rozdzielone imię i nazwisko nowego klienta
  const [nowyKlient, setNowyKlient] = useState({
    rodzaj: "prywatna" as "prywatna" | "firma",
    nazwaFirmy: "",
    nip: "",
    imie: "",
    nazwisko: "",
    telefon: "",
    adres: "",
    email: "",
    numerKotla: "",
  });

  const [opisZlecenia, setOpisZlecenia] = useState("");
  const [typZlecenia, setTypZlecenia] = useState("Przegląd okresowy");
  const [terminRealizacji, setTerminRealizacji] = useState("");
  const [priorytet, setPriorytet] = useState("Normalny");

  const [zapisuje, setZapisuje] = useState(false);
  const [sukces, setSukces] = useState("");
  const [blad, setBlad] = useState("");

  useEffect(() => {
    return gdySesjaAktywna((db) => {
    const q = query(collection(db, KOLEKCJE.klienci), orderBy("utworzono", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map((d) => {
        const data = d.data();
        const imie = data.imie || (data.imieNazwisko ? data.imieNazwisko.split(" ")[0] : "");
        const nazwisko = data.nazwisko || (data.imieNazwisko ? data.imieNazwisko.split(" ").slice(1).join(" ") : "");
        const pelna = `${imie} ${nazwisko}`.trim() || data.imieNazwisko || "Bez nazwy";

        return {
          id: d.id,
          imie,
          nazwisko,
          imieNazwisko: pelna,
          telefon: data.telefon || "",
          adres: data.adres || "",
          numerKotla: data.numerKotla || "",
        };
      });
      setKlienci(lista);
      if (lista.length > 0 && !wybranyKlientId) {
        setWybranyKlientId(lista[0].id);
      }
    });

    return () => unsub();
    });
  }, [wybranyKlientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSukces("");
    setBlad("");

    const db = getDb();
    if (!db) {
      setBlad("Firebase nie jest zainicjalizowany.");
      return;
    }

    setZapisuje(true);

    try {
      let klientId = wybranyKlientId;
      let klientNazwa = "";
      let klientTelefon = "";
      let klientAdres = "";
      let klientKociol = "";

      if (trybKlienta === "nowy") {
        const imieTrim = nowyKlient.imie.trim();
        const nazwiskoTrim = nowyKlient.nazwisko.trim();

        if (!imieTrim || !nazwiskoTrim) {
          throw new Error("Wpisz imię i nazwisko nowego klienta.");
        }

        const klientRef = await addDoc(collection(db, KOLEKCJE.klienci), {
          rodzajKlienta: nowyKlient.rodzaj,
          nazwaFirmy: nowyKlient.rodzaj === "firma" ? nowyKlient.nazwaFirmy.trim() : "",
          nip: nowyKlient.rodzaj === "firma" ? nowyKlient.nip.replace(/\s/g, "") : "",
          imie: imieTrim,
          nazwisko: nazwiskoTrim,
          imieNazwisko: `${imieTrim} ${nazwiskoTrim}`.trim(),
          telefon: nowyKlient.telefon.trim(),
          adres: nowyKlient.adres.trim(),
          email: nowyKlient.email.trim(),
          numerKotla: nowyKlient.numerKotla.trim(),
          utworzono: serverTimestamp(),
        });

        klientId = klientRef.id;
        klientNazwa = `${imieTrim} ${nazwiskoTrim}`.trim();
        klientTelefon = nowyKlient.telefon.trim();
        klientAdres = nowyKlient.adres.trim();
        klientKociol = nowyKlient.numerKotla.trim();
      } else {
        const znaleziony = klienci.find((k) => k.id === wybranyKlientId);
        if (!znaleziony) {
          throw new Error("Wybierz klienta z listy.");
        }
        klientNazwa = znaleziony.imieNazwisko || "";
        klientTelefon = znaleziony.telefon || "";
        klientAdres = znaleziony.adres || "";
        klientKociol = znaleziony.numerKotla || "";
      }

      await addDoc(collection(db, KOLEKCJE.zlecenia), {
        klientId,
        klientNazwa,
        klientTelefon,
        klientAdres,
        klientKociol,
        typZlecenia,
        opisZlecenia: opisZlecenia.trim(),
        terminRealizacji,
        priorytet,
        status: "Nowe",
        utworzono: serverTimestamp(),
      });

      setOpisZlecenia("");
      setTerminRealizacji("");
      setNowyKlient({ rodzaj: "prywatna", nazwaFirmy: "", nip: "", imie: "", nazwisko: "", telefon: "", adres: "", email: "", numerKotla: "" });
      setSukces("Zlecenie zostało pomyślnie dodane!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Wystąpił błąd zapisu.";
      setBlad(msg);
    } finally {
      setZapisuje(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-6">
      <div className="border-b border-slate-100 pb-3">
        <h2 className="text-base font-semibold text-slate-900">Nowe zlecenie serwisowe</h2>
        <p className="text-xs text-slate-500">Wybierz klienta z bazy lub dodaj nowego klienta w locie.</p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTrybKlienta("istniejacy")}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            trybKlienta === "istniejacy"
              ? "bg-navy text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Wybierz z bazy klientów
        </button>
        <button
          type="button"
          onClick={() => setTrybKlienta("nowy")}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            trybKlienta === "nowy"
              ? "bg-navy text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          + Dodaj nowego klienta
        </button>
      </div>

      {trybKlienta === "istniejacy" ? (
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">
            Wybierz klienta
          </label>
          {klienci.length === 0 ? (
            <p className="text-xs text-slate-500">Brak klientów w bazie. Przełącz na &quot;Dodaj nowego klienta&quot;.</p>
          ) : (
            <select
              value={wybranyKlientId}
              onChange={(e) => setWybranyKlientId(e.target.value)}
              className="field"
            >
              {klienci.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.imieNazwisko} {k.adres ? `(${k.adres})` : ""} {k.telefon ? `tel: ${k.telefon}` : ""}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Dane nowego klienta</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setNowyKlient({ ...nowyKlient, rodzaj: "prywatna", nazwaFirmy: "", nip: "" })}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                nowyKlient.rodzaj !== "firma" ? "bg-navy text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Osoba prywatna
            </button>
            <button
              type="button"
              onClick={() => setNowyKlient({ ...nowyKlient, rodzaj: "firma" })}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                nowyKlient.rodzaj === "firma" ? "bg-navy text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Firma
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {nowyKlient.rodzaj === "firma" ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700">Nazwa firmy</label>
                  <input
                    type="text"
                    value={nowyKlient.nazwaFirmy}
                    onChange={(e) => setNowyKlient({ ...nowyKlient, nazwaFirmy: e.target.value })}
                    className="field mt-1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">NIP</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={nowyKlient.nip}
                    onChange={(e) => setNowyKlient({ ...nowyKlient, nip: e.target.value })}
                    placeholder="10 cyfr"
                    className="field mt-1"
                  />
                </div>
              </>
            ) : null}
            <div>
              <label className="block text-xs font-medium text-slate-700">Imię *</label>
              <input
                type="text"
                required
                value={nowyKlient.imie}
                onChange={(e) => setNowyKlient({ ...nowyKlient, imie: e.target.value })}
                className="field mt-1"
                placeholder="Jan"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Nazwisko *</label>
              <input
                type="text"
                required
                value={nowyKlient.nazwisko}
                onChange={(e) => setNowyKlient({ ...nowyKlient, nazwisko: e.target.value })}
                className="field mt-1"
                placeholder="Kowalski"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Telefon</label>
              <input
                type="tel"
                value={nowyKlient.telefon}
                onChange={(e) => setNowyKlient({ ...nowyKlient, telefon: e.target.value })}
                className="field mt-1"
                placeholder="np. 500 600 700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Adres instalacji</label>
              <input
                type="text"
                value={nowyKlient.adres}
                onChange={(e) => setNowyKlient({ ...nowyKlient, adres: e.target.value })}
                className="field mt-1"
                placeholder="ul. Polna 5, Warszawa"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Model / Numer kotła</label>
              <input
                type="text"
                value={nowyKlient.numerKotla}
                onChange={(e) => setNowyKlient({ ...nowyKlient, numerKotla: e.target.value })}
                className="field mt-1"
                placeholder="np. Viessmann Vitodens 100"
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Typ zlecenia</label>
          <select
            value={typZlecenia}
            onChange={(e) => setTypZlecenia(e.target.value)}
            className="field"
          >
            <option value="Przegląd okresowy">Przegląd okresowy</option>
            <option value="Awaria / Naprawa">Awaria / Naprawa</option>
            <option value="Pierwsze uruchomienie">Pierwsze uruchomienie</option>
            <option value="Montaż">Montaż</option>
            <option value="Inne">Inne</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Planowany termin</label>
          <input
            type="date"
            value={terminRealizacji}
            onChange={(e) => setTerminRealizacji(e.target.value)}
            className="field"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Priorytet</label>
          <select
            value={priorytet}
            onChange={(e) => setPriorytet(e.target.value)}
            className="field"
          >
            <option value="Normalny">Normalny</option>
            <option value="Pilny">Pilny</option>
            <option value="Awaria krytyczna (brak ogrzewania)">Awaria krytyczna</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Opis prac / Objawy awarii</label>
        <textarea
          rows={3}
          value={opisZlecenia}
          onChange={(e) => setOpisZlecenia(e.target.value)}
          placeholder="np. Kocioł wyłącza się z błędem F.28, brak ciepłej wody użytkowej..."
          className="field"
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={zapisuje}
          className="btn btn-primary"
        >
          {zapisuje ? "Zapisywanie zlecenia..." : "Dodaj zlecenie"}
        </button>
        {sukces && <span className="text-sm font-medium text-emerald-700">{sukces}</span>}
        {blad && <span className="text-sm font-medium text-red-600">{blad}</span>}
      </div>
    </form>
  );
}