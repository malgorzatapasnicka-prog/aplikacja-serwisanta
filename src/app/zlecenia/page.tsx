import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { KOLEKCJE } from "@/lib/collections";
import { STATUSY_ZLECENIA } from "@/types/zlecenie";

const KOLUMNY = ["Tytuł", "Klient", "Status", "Termin"];

export default function ZleceniaPage() {
  const statusy = Object.values(STATUSY_ZLECENIA).join(", ");

  return (
    <div>
      <PageHeader
        title="Zlecenia"
        description={`Zlecenia serwisowe z kolekcji Firestore ${KOLEKCJE.zlecenia}. Statusy: ${statusy}.`}
      />
      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
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
          title="Brak zleceń"
          description={`Gdy wkleisz klucze Firebase i dodasz dokumenty do kolekcji ${KOLEKCJE.zlecenia}, pojawią się w tej tabeli.`}
        />
      </div>
    </div>
  );
}
