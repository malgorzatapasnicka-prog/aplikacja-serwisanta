import type { DocumentData } from "firebase/firestore";
import type { DaneProtokoluPdf } from "@/lib/daneProtokolu";
import type { CzynnoscProtokolu, Protokol } from "@/types/protokol";

function tekst(wartosc: unknown) {
  return typeof wartosc === "string" ? wartosc.trim() : "";
}

function adresZDokumentu(data: DocumentData) {
  const ulicaZNumerem = [tekst(data.ulica), tekst(data.nrDomu)].filter(Boolean).join(" ");
  const kodZMiastem = [tekst(data.kodPocztowy), tekst(data.miasto)].filter(Boolean).join(" ");
  const nowyAdres = [ulicaZNumerem, kodZMiastem].filter(Boolean).join(", ");
  return nowyAdres || tekst(data.adres);
}

export function protokolyZDokumentu(wartosc: unknown): Protokol[] {
  if (!Array.isArray(wartosc)) {
    return [];
  }

  return wartosc.flatMap((pozycja) => {
    if (!pozycja || typeof pozycja !== "object") {
      return [];
    }

    const raport = pozycja as Record<string, unknown>;
    const czynnosci = raport.czynnosci;
    if (czynnosci !== "przeglad" && czynnosci !== "awaria") {
      return [];
    }
    if (typeof raport.id !== "string") {
      return [];
    }

    return [
      {
        id: raport.id,
        nazwaRaportu: tekst(raport.nazwaRaportu),
        czynnosci: czynnosci as CzynnoscProtokolu,
        status: tekst(raport.status),
        typKotla: tekst(raport.typKotla),
        mocNominalna: tekst(raport.mocNominalna),
        sterownik: tekst(raport.sterownik),
        numerSeryjny: tekst(raport.numerSeryjny),
        grzanie: tekst(raport.grzanie),
        maksymalnaTemperaturaZasilania: tekst(raport.maksymalnaTemperaturaZasilania),
        dataWypelnienia: tekst(raport.dataWypelnienia),
      },
    ];
  });
}

export function daneProtokoluZDokumentu(
  data: DocumentData,
  protokolId: string,
): DaneProtokoluPdf | null {
  const protokol = protokolyZDokumentu(data.protokoly).find((raport) => raport.id === protokolId);
  if (!protokol) {
    return null;
  }

  return {
    imieNazwisko: tekst(data.imieNazwisko),
    adres: adresZDokumentu(data),
    numerKotla: tekst(data.numerKotla),
    nazwaKotla: tekst(data.nazwaKotla),
    protokol,
  };
}
