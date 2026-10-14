import { AddClientForm } from "@/components/AddClientForm";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { KOLEKCJE } from "@/lib/collections";

const KOLUMNY = ["Imię i nazwisko", "Telefon", "Adres", "E-mail"];

export default function KlienciPage() {
  return (
    <div>
      <PageHeader
        title="Klienci"
        description={`Dodaj klienta do kolekcji Firestore ${KOLEKCJE.klienci}. Zapis obejmuje imię i nazwisko, telefon, e-mail, adres, datę ostatniego przeglądu i numer kotła.`}
      />
      <AddClientForm />
      <div className="mt-8 overflow-x-auto rounded-xl border border-stone-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-stone-500">
            <tr>
              {KOLUMNY.map((kolumna) => (
                <th key={kolumna} className="px-4 py-3 font-medium whitespace-nowrap">
                  {kolumna}
                </th>
              ))}
            </tr>
          </thead>
        </table>
        <EmptyState
          title="Brak klientów"
          description="Nowy klient zapisuje się w Firestore. Lista w tej tabeli pojawi się po podłączeniu odczytu kolekcji."
        />
      </div>
    </div>
  );
}
