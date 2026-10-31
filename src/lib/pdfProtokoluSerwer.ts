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
    const protokolSnap = await getDoc(doc(db, KOLEKCJE.klienci, klientId, "protokoly", protokolId));
    const tablica = Array.isArray(klient.protokoly) ? klient.protokoly : [];
    const zPodkolekcji = protokolSnap.exists() ? [{ id: protokolSnap.id, ...protokolSnap.data() }] : [];
    const dane = daneProtokoluZDokumentu(
      {
        ...klient,
        protokoly: [
          ...tablica.filter(
            (pozycja) => !pozycja || typeof pozycja !== "object" || (pozycja as { id?: unknown }).id !== protokolId,
          ),
          ...zPodkolekcji,
        ],
      },
      protokolId,
    );
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
      const zalacznik = await getDoc(doc(db, KOLEKCJE.zalacznikiProtokolu, protokolId));
      const zeStaregoMiejsca = zalacznik.exists() ? zalacznik.data().pdf : "";
      const adresNowy = protokolSnap.exists() ? protokolSnap.data().zalacznikPdf : "";
      const tresc =
        typeof zeStaregoMiejsca === "string" && zeStaregoMiejsca.startsWith("data:application/pdf")
          ? zeStaregoMiejsca
          : typeof adresNowy === "string"
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
    if (error instanceof FirebaseError && error.code === "permission-denied") {
      throw new BladPdf("Firestore odrzuciło odczyt klienta.", 403);
    }
    const komunikat = error instanceof Error ? error.message : "Nie udało się utworzyć PDF.";
    throw new BladPdf(komunikat, 500);
  }
}
