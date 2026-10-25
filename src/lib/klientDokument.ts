import type { DocumentData } from "firebase/firestore";
import type { DaneProtokoluPdf } from "@/lib/daneProtokolu";
import type { CzynnoscProtokolu, Protokol } from "@/types/protokol";

function tekst(wartosc: unknown) {
  return typeof wartosc === "string" ? wartosc.trim() : "";
}

function tak(wartosc: unknown) {
  return wartosc === true;
}

function zdjeciaZDokumentu(wartosc: unknown) {
  if (!Array.isArray(wartosc)) {
    return [];
  }
  return wartosc
    .filter((pozycja): pozycja is string => typeof pozycja === "string" && pozycja.startsWith("data:image/"))
    .slice(0, 10);
}

function obrazPodpisu(wartosc: unknown) {
  return typeof wartosc === "string" && wartosc.startsWith("data:image/png") ? wartosc : "";
}

function podpisyZDokumentu(wartosc: unknown, ile: number) {
  const zrodlo = Array.isArray(wartosc) ? wartosc : [];
  return Array.from({ length: ile }, (_, indeks) => tekst(zrodlo[indeks]));
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
        numerProtokolu: tekst(raport.numerProtokolu),
        modelKotla: tekst(raport.modelKotla),
        numerKotla: tekst(raport.numerKotla),
        zadanaTemperaturaGrzania: tekst(raport.zadanaTemperaturaGrzania),
        szczelnoscGazowa: tak(raport.szczelnoscGazowa),
        cisnienieCO: tekst(raport.cisnienieCO),
        zaworKociol: tak(raport.zaworKociol),
        cisnienieNaczynia: tekst(raport.cisnienieNaczynia),
        czyszczenieWymiennika: tak(raport.czyszczenieWymiennika),
        czyszczeniePalnika: tak(raport.czyszczeniePalnika),
        sprawdzenieSyfonu: tak(raport.sprawdzenieSyfonu),
        inneCzynnosci: tekst(raport.inneCzynnosci),
        dataKolejnegoPrzegladu: tekst(raport.dataKolejnegoPrzegladu),
        uwagi: tekst(raport.uwagi),
        zdjecia: zdjeciaZDokumentu(raport.zdjecia),
        podpisyZdjec: podpisyZDokumentu(raport.podpisyZdjec, zdjeciaZDokumentu(raport.zdjecia).length),
        podpisKlienta: obrazPodpisu(raport.podpisKlienta),
        podpisSerwisanta: obrazPodpisu(raport.podpisSerwisanta),
        maZalacznikPdf: tak(raport.maZalacznikPdf),
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
