"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { KOLEKCJE } from "@/lib/collections";
import { getDb, getFirebaseApp, gdySesjaAktywna } from "@/lib/firebase";
import { PageHeader } from "@/components/PageHeader";
import { AddOrderForm } from "@/components/AddOrderForm";

type ZlecenieDokument = {
  id: string;
  klientNazwa?: string;
  klientTelefon?: string;
  klientAdres?: string;
  klientKociol?: string;
  typZlecenia?: string;
  opisZlecenia?: string;
  terminRealizacji?: string;
  priorytet?: string;
  status?: string;
};

export default function ZleceniaPage() {
  const [zlecenia, setZlecenia] = useState<ZlecenieDokument[]>([]);
  const [laduje, setLaduje] = useState(true);

  useEffect(() => {
    if (!getFirebaseApp()) {
      setLaduje(false);
      return;
    }

    return gdySesjaAktywna((db) => {
      const q = query(collection(db, KOLEKCJE.zlecenia), orderBy("utworzono", "desc"));
      return onSnapshot(q, (snap) => {
        const lista = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setZlecenia(lista);
        setLaduje(false);
      });
    });
  }, []);

  const zmienStatus = async (id: string, nowyStatus: string) => {
    const db = getDb();
    if (!db) return;
    await updateDoc(doc(db, KOLEKCJE.zlecenia, id), { status: nowyStatus });
  };

  const usunZlecenie = async (id: string) => {
    if (!window.confirm("Czy na pewno usunąć to zlecenie?")) return;
    const db = getDb();
    if (!db) return;
    await deleteDoc(doc(db, KOLEKCJE.zlecenia, id));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Zlecenia serwisowe"
        description="Zarządzaj zleceniami, planuj naprawy i twórz nowe zadania serwisowe."
      />

      <AddOrderForm />

      <div className="space-y-4">
        <h3 className="text-base font-semibold text-stone-900">Aktualne zlecenia ({zlecenia.length})</h3>

        {laduje ? (
          <div className="p-8 text-center text-sm text-stone-500 bg-white rounded-xl border border-stone-200">
            Ładowanie zleceń...
          </div>
        ) : zlecenia.length === 0 ? (
          <div className="p-8 text-center text-sm text-stone-500 bg-white rounded-xl border border-dashed border-stone-300">
            Brak zarejestrowanych zleceń. Dodaj pierwsze powyżej.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {zlecenia.map((zl) => (
              <div
                key={zl.id}
                className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
                      {zl.typZlecenia || "Serwis"}
                    </span>
                    <h4 className="text-lg font-bold text-stone-900">{zl.klientNazwa}</h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={zl.status || "Nowe"}
                      onChange={(e) => zmienStatus(zl.id, e.target.value)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold border ${
                        zl.status === "Zrealizowane"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : zl.status === "W toku"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      <option value="Nowe">Nowe</option>
                      <option value="W toku">W toku</option>
                      <option value="Zrealizowane">Zrealizowane</option>
                      <option value="Anulowane">Anulowane</option>
                    </select>
                    <button
                      onClick={() => usunZlecenie(zl.id)}
                      className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 transition"
                      title="Usuń zlecenie"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-sm">
                  <div>
                    <span className="text-[11px] font-semibold uppercase text-stone-500 block">Telefon</span>
                    <span className="text-stone-900 font-medium">{zl.klientTelefon || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase text-stone-500 block">Adres</span>
                    <span className="text-stone-900 font-medium">{zl.klientAdres || "—"}</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase text-stone-500 block">Termin / Priorytet</span>
                    <span className="text-stone-900 font-medium">
                      {zl.terminRealizacji || "Brak terminu"} ({zl.priorytet || "Normalny"})
                    </span>
                  </div>
                </div>

                {zl.opisZlecenia && (
                  <div className="rounded-lg bg-stone-50 p-3 text-xs text-stone-700 border border-stone-100">
                    <strong className="block text-stone-900 mb-0.5">Opis usterki / zakres prac:</strong>
                    {zl.opisZlecenia}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}