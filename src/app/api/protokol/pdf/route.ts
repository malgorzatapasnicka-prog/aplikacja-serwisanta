import { nazwaPlikuPdf } from "@/lib/daneProtokolu";
import { BladPdf, utworzPdfDlaProtokolu } from "@/lib/pdfProtokoluSerwer";

function blad(tekst: string, status: number) {
  return Response.json({ blad: tekst }, { status });
}

function tekst(wartosc: unknown) {
  return typeof wartosc === "string" ? wartosc.trim() : "";
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return blad("Nieprawidłowe żądanie.", 400);
  }

  const klientId = body && typeof body === "object" && "klientId" in body ? tekst(body.klientId) : "";
  const protokolId = body && typeof body === "object" && "protokolId" in body ? tekst(body.protokolId) : "";

  try {
    const { pdf, nazwaRaportu } = await utworzPdfDlaProtokolu(klientId, protokolId);
    const nazwa = nazwaPlikuPdf(nazwaRaportu);

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nazwa}"`,
      },
    });
  } catch (error) {
    if (error instanceof BladPdf) {
      return blad(error.message, error.status);
    }

    const komunikat = error instanceof Error ? error.message : "Nie udało się utworzyć PDF.";
    return blad(komunikat, 500);
  }
}
