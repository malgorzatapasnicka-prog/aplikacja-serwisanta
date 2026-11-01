import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { RozliczeniaPrzeglad } from "@/components/RozliczeniaPrzeglad";

export default function RozliczeniaPage() {
  return (
    <div>
      <PageHeader
        title="Rozliczenia"
        description="Kwoty z protokołów i ich sumy za wybrany okres. To informacje tylko dla serwisanta, klient ich nie widzi."
      />
      {/* Suspense: komponent używa bieżącej daty (domyślny okres = ten miesiąc), więc nie jest prerenderowany. */}
      <Suspense
        fallback={
          <div className="card text-center text-sm text-slate-500">
            Ładowanie rozliczeń...
          </div>
        }
      >
        <RozliczeniaPrzeglad />
      </Suspense>
    </div>
  );
}
