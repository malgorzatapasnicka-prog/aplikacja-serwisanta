import { FirebaseError } from "firebase/app";
import { doc, getDoc } from "firebase/firestore";
import { KOLEKCJE } from "@/lib/collections";
import { dolaczZalacznikPdf } from "@/lib/dolaczZalacznikPdf";
import { getServerDb } from "@/lib/firebaseServer";
import { daneProtokoluZDokumentu } from "@/lib/klientDokument";
import { utworzPdfLatex } from "@/lib/protokolLatex";
import { utworzPdfProtokolu } from "@/lib/protokolPdf";

const ID_DOKUMENTU = /^[A-Za-z0-9_-]{8,128}$/;

export class BladPdf extends Error {
  readonly status: number;

  constructor(tekst: string, status: number) {
    super(tekst);
    this.name = "BladPdf";
    this.status = status;
  }
}

export async function utworzPdfDlaProtokolu(klientId: string, protokolId: string) {
  if (!ID_DOKUMENTU.test(klientId) || !ID_DOKUMENTU.test(protokolId)) {
    throw new BladPdf("Brak danych protokołu.", 400);
  }

  const db = getServerDb();
  if (!db) {
    throw new BladPdf("Firebase nie jest skonfigurowany.", 503);
  }

  try {
    const snapshot = await getDoc(doc(db, KOLEKCJE.klienci, klientId));
    if (!snapshot.exists()) {
      throw new BladPdf("Nie znaleziono klienta.", 404);
    }

    const dane = daneProtokoluZDokumentu(snapshot.data(), protokolId);
    if (!dane) {
      throw new BladPdf("Nie znaleziono protokołu.", 404);
    }

    let pdf = (await utworzPdfLatex(dane)) ?? utworzPdfProtokolu(dane);
    if (dane.protokol.maZalacznikPdf) {
      const zalacznik = await getDoc(doc(db, KOLEKCJE.zalacznikiProtokolu, protokolId));
      const tresc = zalacznik.exists() ? zalacznik.data().pdf : "";
      if (typeof tresc === "string" && tresc.startsWith("data:application/pdf")) {
        pdf = await dolaczZalacznikPdf(pdf, tresc);
      }
    }

    return { pdf, nazwaRaportu: dane.protokol.nazwaRaportu || "" };
  } catch (error) {
    if (error instanceof BladPdf) {
      throw error;
    }
    if (error instanceof FirebaseError && error.code === "permission-denied") {
      throw new BladPdf("Firestore odrzuciło odczyt klienta.", 403);
    }
    const komunikat = error instanceof Error ? error.message : "Nie udało się utworzyć PDF.";
    throw new BladPdf(komunikat, 500);
  }
}
