import { Magazyn } from "@/components/Magazyn";
import { PageHeader } from "@/components/PageHeader";

export default function MagazynPage() {
  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader
          title="Magazyn"
          description="Stan części, ich wartość i remanent do wydruku."
        />
      </div>
      <Magazyn />
    </div>
  );
}
