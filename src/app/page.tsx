import Link from "next/link";
import { ClientList } from "@/components/ClientList";
import { PageHeader } from "@/components/PageHeader";
import { KOLEKCJE } from "@/lib/collections";

const KARTY = [
  {
    label: "Baza klientów",
    opis: `Pełna lista i formularz w kolekcji ${KOLEKCJE.klienci}`,
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
        description="Po uruchomieniu aplikacji zapisani klienci są od razu na tej stronie."
      />
      <ClientList opisPustej="Brak zapisanych klientów. Dodasz ich w zakładce Baza klientów." />
      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        {KARTY.map((karta) => (
          <Link
            key={karta.label}
            href={karta.href}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-slate-300"
          >
            <p className="text-sm font-medium text-slate-900">{karta.label}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{karta.opis}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
