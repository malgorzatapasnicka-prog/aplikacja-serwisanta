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

async function pobierzJakoDataUrl(adres: string) {
  if (!/^https?:\/\//i.test(adres)) {
    return adres;
  }

  const odpowiedz = await fetch(adres);
  if (!odpowiedz.ok) {
    return "";
  }

  const mime = odpowiedz.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
  const bajty = Buffer.from(await odpowiedz.arrayBuffer());
  return `data:${mime};base64,${bajty.toString("base64")}`;
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

    const klient = snapshot.data();
    let rekordPodkolekcji: Record<string, unknown> | null = null;
    let idPodkolekcji = "";
    try {
      const odczytPodkolekcji = await getDoc(doc(db, KOLEKCJE.klienci, klientId, "protokoly", protokolId));
      if (odczytPodkolekcji.exists()) {
        const surowy = odczytPodkolekcji.data();
        rekordPodkolekcji = surowy && typeof surowy === "object" ? (surowy as Record<string, unknown>) : null;
        idPodkolekcji = odczytPodkolekcji.id;
      }
    } catch (error) {
      if (!(error instanceof FirebaseError) || (error.code !== "permission-denied" && error.code !== "unauthenticated")) {
        throw error;
      }
    }
    const tablica = Array.isArray(klient.protokoly) ? klient.protokoly : [];
    const protokoly = rekordPodkolekcji
      ? [
          ...tablica.filter(
            (pozycja) => !pozycja || typeof pozycja !== "object" || (pozycja as { id?: unknown }).id !== protokolId,
          ),
          { id: idPodkolekcji, ...rekordPodkolekcji },
        ]
      : tablica;
    const dane = daneProtokoluZDokumentu({ ...klient, protokoly }, protokolId);
    if (!dane) {
      throw new BladPdf("Nie znaleziono protokołu.", 404);
    }

    if (dane.protokol.zdjecia) {
      dane.protokol.zdjecia = (
        await Promise.all(dane.protokol.zdjecia.map((adres) => pobierzJakoDataUrl(adres)))
      ).filter((adres) => adres.startsWith("data:image/"));
    }

    let pdf = (await utworzPdfLatex(dane)) ?? utworzPdfProtokolu(dane);
    if (dane.protokol.maZalacznikPdf) {
      let zeStaregoMiejsca = "";
      try {
        const zalacznik = await getDoc(doc(db, KOLEKCJE.zalacznikiProtokolu, protokolId));
        const pdfZalacznika = zalacznik.exists() ? zalacznik.data()?.pdf : "";
        zeStaregoMiejsca = typeof pdfZalacznika === "string" ? pdfZalacznika : "";
      } catch (error) {
        if (!(error instanceof FirebaseError) || (error.code !== "permission-denied" && error.code !== "unauthenticated")) {
          throw error;
        }
      }
      const adresNowy = typeof rekordPodkolekcji?.zalacznikPdf === "string" ? rekordPodkolekcji.zalacznikPdf : "";
      const tresc =
        zeStaregoMiejsca.startsWith("data:application/pdf")
          ? zeStaregoMiejsca
          : adresNowy
            ? await pobierzJakoDataUrl(adresNowy)
            : "";
      if (tresc.startsWith("data:application/pdf")) {
        pdf = await dolaczZalacznikPdf(pdf, tresc);
      }
    }

    return { pdf, nazwaRaportu: dane.protokol.nazwaRaportu || "" };
  } catch (error) {
    if (error instanceof BladPdf) {
      throw error;
    }
    const komunikat = error instanceof Error ? error.message : "Nie udało się utworzyć PDF.";
    throw new BladPdf(komunikat, 500);
  }
}
