import type { DocumentData } from "firebase/firestore";
import type { DaneProtokoluPdf } from "@/lib/daneProtokolu";
import {
  GRUPY_CHECKLISTY,
  stanChecklisty,
  wynikKontroli,
  type ChecklistaProtokolu,
  type CzynnoscProtokolu,
  type Protokol,
} from "@/types/protokol";

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
    .filter(
      (pozycja): pozycja is string =>
        typeof pozycja === "string" && (pozycja.startsWith("data:image/") || /^https?:\/\//i.test(pozycja)),
    )
    .slice(0, 10);
}

function obrazPodpisu(wartosc: unknown) {
  return typeof wartosc === "string" && wartosc.startsWith("data:image/png") ? wartosc : "";
}

function podpisyZDokumentu(wartosc: unknown, ile: number) {
  const zrodlo = Array.isArray(wartosc) ? wartosc : [];
  return Array.from({ length: ile }, (_, indeks) => tekst(zrodlo[indeks]));
}

function liczba(wartosc: unknown) {
  if (typeof wartosc === "number" && Number.isFinite(wartosc)) {
    return wartosc;
  }
  if (typeof wartosc === "string" && wartosc.trim()) {
    const wynik = Number(wartosc.trim().replace(",", "."));
    if (Number.isFinite(wynik)) {
      return wynik;
    }
  }
  return undefined;
}

function checklistaZDokumentu(wartosc: unknown): ChecklistaProtokolu | undefined {
  if (!wartosc || typeof wartosc !== "object") {
    return undefined;
  }
  const zrodlo = wartosc as Record<string, unknown>;
  const wynik: ChecklistaProtokolu = {};
  for (const grupa of GRUPY_CHECKLISTY) {
    for (const [klucz] of grupa.pola) {
      const stan = stanChecklisty(zrodlo[klucz]);
      if (stan) {
        wynik[klucz] = stan;
      }
    }
  }
  return Object.keys(wynik).length > 0 ? wynik : undefined;
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
        wynikSzczelnosci: wynikKontroli(
          raport.wynikSzczelnosci,
          tak(raport.szczelnoscGazowa) || tak(raport.zaworKociol),
        ),
        cisnienieCO: tekst(raport.cisnienieCO),
        cisnienieCONieDotyczy: tak(raport.cisnienieCONieDotyczy),
        zaworKociol: tak(raport.zaworKociol),
        wynikLancucha: wynikKontroli(raport.wynikLancucha),
        cisnienieNaczynia: tekst(raport.cisnienieNaczynia),
        cisnienieNaczyniaNieDotyczy: tak(raport.cisnienieNaczyniaNieDotyczy),
        czyszczenieWymiennika: raport.czyszczenieWymiennika === "nie_dotyczy" ? "nie_dotyczy" : tak(raport.czyszczenieWymiennika),
        czyszczeniePalnika: raport.czyszczeniePalnika === "nie_dotyczy" ? "nie_dotyczy" : tak(raport.czyszczeniePalnika),
        sprawdzenieSyfonu: raport.sprawdzenieSyfonu === "nie_dotyczy" ? "nie_dotyczy" : tak(raport.sprawdzenieSyfonu),
        inneCzynnosci: tekst(raport.inneCzynnosci),
        inneNieDotyczy: tak(raport.inneNieDotyczy),
        dataKolejnegoPrzegladu: tekst(raport.dataKolejnegoPrzegladu),
        kolejnyPrzegladNieDotyczy: tak(raport.kolejnyPrzegladNieDotyczy),
        uwagi: tekst(raport.uwagi),
        zdjecia: zdjeciaZDokumentu(raport.zdjecia),
        podpisyZdjec: podpisyZDokumentu(raport.podpisyZdjec, zdjeciaZDokumentu(raport.zdjecia).length),
        podpisKlienta: obrazPodpisu(raport.podpisKlienta),
        podpisSerwisanta: obrazPodpisu(raport.podpisSerwisanta),
        maZalacznikPdf: tak(raport.maZalacznikPdf),
        ...(tekst(raport.modelUrzadzenia) ? { modelUrzadzenia: tekst(raport.modelUrzadzenia) } : {}),
        ...(tekst(raport.numerFabryczny) ? { numerFabryczny: tekst(raport.numerFabryczny) } : {}),
        ...(tekst(raport.rodzajGazu) ? { rodzajGazu: tekst(raport.rodzajGazu) } : {}),
        ...(tekst(raport.opisUslugi) ? { opisUslugi: tekst(raport.opisUslugi) } : {}),
        ...(liczba(raport.uslugaNetto) !== undefined ? { uslugaNetto: liczba(raport.uslugaNetto) } : {}),
        ...(liczba(raport.uslugaBrutto) !== undefined ? { uslugaBrutto: liczba(raport.uslugaBrutto) } : {}),
        ...(liczba(raport.dojazdNetto) !== undefined ? { dojazdNetto: liczba(raport.dojazdNetto) } : {}),
        ...(liczba(raport.dojazdBrutto) !== undefined ? { dojazdBrutto: liczba(raport.dojazdBrutto) } : {}),
        ...(liczba(raport.materialyNetto) !== undefined ? { materialyNetto: liczba(raport.materialyNetto) } : {}),
        ...(liczba(raport.materialyBrutto) !== undefined ? { materialyBrutto: liczba(raport.materialyBrutto) } : {}),
        ...(tekst(raport.cisnienieGazuStatyczne) ? { cisnienieGazuStatyczne: tekst(raport.cisnienieGazuStatyczne) } : {}),
        ...(tekst(raport.cisnienieWodyGrzewczej) ? { cisnienieWodyGrzewczej: tekst(raport.cisnienieWodyGrzewczej) } : {}),
        ...(tekst(raport.cisnienieWstepneNaczynia) ? { cisnienieWstepneNaczynia: tekst(raport.cisnienieWstepneNaczynia) } : {}),
        ...(checklistaZDokumentu(raport.checklista) ? { checklista: checklistaZDokumentu(raport.checklista) } : {}),
        ...(tak(raport.powierzchniaDo300) ? { powierzchniaDo300: true } : {}),
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

export function scalProtokoly<T extends { id: string; dataWypelnienia?: string }>(
  zTablicy: readonly T[],
  zPodkolekcji: readonly T[],
): T[] {
  const mapa = new Map<string, T>();
  for (const protokol of zTablicy) {
    if (protokol?.id) {
      mapa.set(protokol.id, protokol);
    }
  }
  for (const protokol of zPodkolekcji) {
    if (protokol?.id) {
      mapa.set(protokol.id, protokol);
    }
  }

  return [...mapa.values()].sort(
    (a, b) => (a.dataWypelnienia || "").localeCompare(b.dataWypelnienia || "") || a.id.localeCompare(b.id),
  );
}
