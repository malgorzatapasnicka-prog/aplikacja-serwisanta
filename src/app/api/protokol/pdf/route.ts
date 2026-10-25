import { FirebaseError } from "firebase/app";
import { doc, getDoc } from "firebase/firestore";
import { nazwaPlikuPdf } from "@/lib/daneProtokolu";
import { KOLEKCJE } from "@/lib/collections";
import { getServerDb } from "@/lib/firebaseServer";
import { daneProtokoluZDokumentu } from "@/lib/klientDokument";
import { dolaczZalacznikPdf } from "@/lib/dolaczZalacznikPdf";
import { utworzPdfLatex } from "@/lib/protokolLatex";
import { utworzPdfProtokolu } from "@/lib/protokolPdf";

function blad(tekst: string, status: number) {
  return Response.json({ blad: tekst }, { status });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return blad("Nieprawidłowe żądanie.", 400);
  }

  const klientId =
    body && typeof body === "object" && "klientId" in body && typeof body.klientId === "string"
      ? body.klientId
      : "";
  const protokolId =
    body && typeof body === "object" && "protokolId" in body && typeof body.protokolId === "string"
      ? body.protokolId
      : "";

  if (!/^[A-Za-z0-9_-]{8,128}$/.test(klientId) || !/^[A-Za-z0-9_-]{8,128}$/.test(protokolId)) {
    return blad("Brak danych protokołu.", 400);
  }

  const db = getServerDb();
  if (!db) {
    return blad("Firebase nie jest skonfigurowany.", 503);
  }

  try {
    const snapshot = await getDoc(doc(db, KOLEKCJE.klienci, klientId));
    if (!snapshot.exists()) {
      return blad("Nie znaleziono klienta.", 404);
    }

    const dane = daneProtokoluZDokumentu(snapshot.data(), protokolId);
    if (!dane) {
      return blad("Nie znaleziono protokołu.", 404);
    }

    let pdf = (await utworzPdfLatex(dane)) ?? utworzPdfProtokolu(dane);
    if (dane.protokol.maZalacznikPdf) {
      const zalacznik = await getDoc(doc(db, KOLEKCJE.zalacznikiProtokolu, protokolId));
      const tresc = zalacznik.exists() ? zalacznik.data().pdf : "";
      if (typeof tresc === "string" && tresc.startsWith("data:application/pdf")) {
        pdf = await dolaczZalacznikPdf(pdf, tresc);
      }
    }
    const nazwa = nazwaPlikuPdf(dane.protokol.nazwaRaportu);

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nazwa}"`,
      },
    });
  } catch (error) {
    if (error instanceof FirebaseError && error.code === "permission-denied") {
      return blad("Firestore odrzuciło odczyt klienta.", 403);
    }

    const komunikat = error instanceof Error ? error.message : "Nie udało się utworzyć PDF.";
    return blad(komunikat, 500);
  }
}
