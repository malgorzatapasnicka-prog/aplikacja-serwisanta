"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { KOLEKCJE } from "@/lib/collections";
import { getDb } from "@/lib/firebase";

type KlientOpcja = {
  id: string;
  imieNazwisko?: string;
  telefon?: string;
  adres?: string;
  numerKotla?: string;
};

export function AddOrderForm() {
  const [trybKlienta, setTrybKlienta] = useState<"istniejacy" | "nowy">("istniejacy");
  const [klienci, setKlienci] = useState<KlientOpcja[]>([]);
  const [wybranyKlientId, setWybranyKlientId] = useState("");

  // Dane nowego klienta (gdy wybrano tryb "nowy")
  const [nowyKlient, setNowyKlient] = useState({
    imieNazwisko: "",
    telefon: "",
    adres: "",
    email: "",
    numerKotla: "",
  });

  // Dane zlecenia
  const [opisZlecenia, setOpisZlecenia] = useState("");
  const [typZlecenia, setTypZlecenia] = useState("Przegląd okresowy");
  const [terminRealizacji, setTerminRealizacji] = useState("");
  const [priorytet, setPriorytet] = useState("Normalny");

  const [zapisuje, setZapisuje] = useState(false);
  const [sukces, setSukces] = useState("");
  const [blad, setBlad] = useState("");

  // Pobieranie listy istniejących klientów do listy rozwijanej
  useEffect(() => {
    const db = getDb();
    if (!db) return;

    const q = query(collection(db, KOLEKCJE.klienci), orderBy("imieNazwisko", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const lista = snap.docs.map((d) => ({
        id: d.id,
        imieNazwisko: d.data().imieNazwisko || "Bez nazwy",
        telefon: d.data().telefon || "",
        adres: d.data().adres || "",
        numerKotla: d.data().numerKotla || "",
      }));
      setKlienci(lista);
      if (lista.length > 0 && !wybranyKlientId) {
        setWybranyKlientId(lista[0].id);
      }
    });

    return () => unsub();
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
        if (!nowyKlient.imieNazwisko.trim()) {
          throw new Error("Wpisz imię i nazwisko nowego klienta.");
        }

        // 1. Utworzenie nowego klienta w bazie
        const klientRef = await addDoc(collection(db, KOLEKCJE.klienci), {
          imieNazwisko: nowyKlient.imieNazwisko.trim(),
          telefon: nowyKlient.telefon.trim(),
          adres: nowyKlient.adres.trim(),
          email: nowyKlient.email.trim(),
          numerKotla: nowyKlient.numerKotla.trim(),
          utworzono: serverTimestamp(),
        });

        klientId = klientRef.id;
        klientNazwa = nowyKlient.imieNazwisko.trim();
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

      // 2. Utworzenie zlecenia powiązanego z klientem
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

      // Czyszczenie formularza
      setOpisZlecenia("");
      setTerminRealizacji("");
      setNowyKlient({ imieNazwisko: "", telefon: "", adres: "", email: "", numerKotla: "" });
      setSukces("Zlecenie zostało pomyślnie dodane!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Wystąpił błąd zapisu.";
      setBlad(msg);
    } finally {
      setZapisuje(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm space-y-5">
      <div className="border-b border-stone-100 pb-3">
        <h2 className="text-base font-semibold text-stone-900">Nowe zlecenie serwisowe</h2>
        <p className="text-xs text-stone-500">Wybierz klienta z bazy lub dodaj nowego klienta w locie.</p>
      </div>

      {/* Przełącznik wyboru klienta */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTrybKlienta("istniejacy")}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            trybKlienta === "istniejacy"
              ? "bg-amber-500 text-stone-950"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          Wybierz z bazy klientów
        </button>
        <button
          type="button"
          onClick={() => setTrybKlienta("nowy")}
          className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
            trybKlienta === "nowy"
              ? "bg-amber-500 text-stone-950"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          + Dodaj nowego klienta
        </button>
      </div>

      {trybKlienta === "istniejacy" ? (
        <div>
          <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
            Wybierz klienta
          </label>
          {klienci.length === 0 ? (
            <p className="text-xs text-stone-500">Brak klientów w bazie. Przełącz na &quot;Dodaj nowego klienta&quot;.</p>
          ) : (
            <select
              value={wybranyKlientId}
              onChange={(e) => setWybranyKlientId(e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none focus:border-amber-400"
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
        <div className="rounded-lg border border-stone-200 bg-stone-50/50 p-4 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Dane nowego klienta</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-stone-700">Imię i nazwisko *</label>
              <input
                type="text"
                required
                value={nowyKlient.imieNazwisko}
                onChange={(e) => setNowyKlient({ ...nowyKlient, imieNazwisko: e.target.value })}
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-amber-400"
                placeholder="Jan Kowalski"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700">Telefon</label>
              <input
                type="tel"
                value={nowyKlient.telefon}
                onChange={(e) => setNowyKlient({ ...nowyKlient, telefon: e.target.value })}
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-amber-400"
                placeholder="np. 500 600 700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700">Adres instalacji</label>
              <input
                type="text"
                value={nowyKlient.adres}
                onChange={(e) => setNowyKlient({ ...nowyKlient, adres: e.target.value })}
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-amber-400"
                placeholder="ul. Polna 5, Warszawa"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700">Model / Numer kotła</label>
              <input
                type="text"
                value={nowyKlient.numerKotla}
                onChange={(e) => setNowyKlient({ ...nowyKlient, numerKotla: e.target.value })}
                className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-amber-400"
                placeholder="np. Viessmann Vitodens 100"
              />
            </div>
          </div>
        </div>
      )}

      {/* Dane zlecenia */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">Typ zlecenia</label>
          <select
            value={typZlecenia}
            onChange={(e) => setTypZlecenia(e.target.value)}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400"
          >
            <option value="Przegląd okresowy">Przegląd okresowy</option>
            <option value="Awaria / Naprawa">Awaria / Naprawa</option>
            <option value="Pierwsze uruchomienie">Pierwsze uruchomienie</option>
            <option value="Montaż">Montaż</option>
            <option value="Inne">Inne</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">Planowany termin</label>
          <input
            type="date"
            value={terminRealizacji}
            onChange={(e) => setTerminRealizacji(e.target.value)}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">Priorytet</label>
          <select
            value={priorytet}
            onChange={(e) => setPriorytet(e.target.value)}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400"
          >
            <option value="Normalny">Normalny</option>
            <option value="Pilny">Pilny</option>
            <option value="Awaria krytyczna (brak ogrzewania)">Awaria krytyczna</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">Opis prac / Objawy awarii</label>
        <textarea
          rows={3}
          value={opisZlecenia}
          onChange={(e) => setOpisZlecenia(e.target.value)}
          placeholder="np. Kocioł wyłącza się z błędem F.28, brak ciepłej wody użytkowej..."
          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400"
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={zapisuje}
          className="rounded-lg bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
        >
          {zapisuje ? "Zapisywanie zlecenia..." : "Dodaj zlecenie"}
        </button>
        {sukces && <span className="text-sm font-medium text-emerald-700">{sukces}</span>}
        {blad && <span className="text-sm font-medium text-red-600">{blad}</span>}
      </div>
    </form>
  );
}