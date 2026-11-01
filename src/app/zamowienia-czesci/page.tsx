import { PageHeader } from "@/components/PageHeader";
import { ZamowieniaCzesci } from "@/components/ZamowieniaCzesci";

export default function ZamowieniaCzesciPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Zamówienia na części"
        description="Zapisuj części, które trzeba zamówić dla klientów, i zmieniaj status zamówienia."
      />
      <ZamowieniaCzesci />
    </div>
  );
}
