import Link from "next/link";
import { FirebaseStatus } from "@/components/FirebaseStatus";
import { PageHeader } from "@/components/PageHeader";
import { KOLEKCJE } from "@/lib/collections";
import { isFirebaseConfigured } from "@/lib/firebaseConfig";

const KARTY = [
  {
    label: "Klienci",
    opis: `Baza kontaktów w kolekcji ${KOLEKCJE.klienci}`,
    href: "/klienci",
  },
  {
    label: "Zlecenia",
    opis: `Wizyty i naprawy w kolekcji ${KOLEKCJE.zlecenia}`,
    href: "/zlecenia",
  },
];

export default function Home() {
  return (
    <div>
      <PageHeader
        title="Pulpit"
        description="System CRM do prowadzenia klientów i zleceń serwisowych. Dane będą zapisywane w Cloud Firestore."
      />
      <FirebaseStatus />
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {KARTY.map((karta) => (
          <Link
            key={karta.label}
            href={karta.href}
            className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition-colors hover:border-amber-300"
          >
            <p className="text-sm font-medium text-stone-500">{karta.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">—</p>
            <p className="mt-2 text-sm leading-6 text-stone-600">{karta.opis}</p>
          </Link>
        ))}
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-stone-500">Firestore</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">—</p>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            {isFirebaseConfigured()
              ? "Klucze są wklejone. Odczyt kolekcji można już podłączyć."
              : "Połączenie pojawi się po wklejeniu kluczy"}
          </p>
        </div>
      </section>
    </div>
  );
}
