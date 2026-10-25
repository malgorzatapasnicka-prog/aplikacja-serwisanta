import { Suspense } from "react";
import { AddClientForm } from "@/components/AddClientForm";
import { ClientList } from "@/components/ClientList";
import { PageHeader } from "@/components/PageHeader";

export default function KlienciPage() {
  return (
    <div>
      <PageHeader
        title="Baza klientów"
        description="Tutaj widać zapisanych klientów. Formularz dodawania jest pod listą."
      />
      <Suspense fallback={<div>Ładowanie danych...</div>}>
        <ClientList opisPustej="Dodaj pierwszego klienta formularzem poniżej." />
      </Suspense>
      <div className="mt-8">
        <AddClientForm />
      </div>
    </div>
  );
}
