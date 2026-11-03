/**
 * Codzienne przypomnienie SMS: 9 miesięcy po dacie przeglądu.
 *
 * Vercel wywołuje ten adres raz dziennie (vercel.json). Żeby nikt postronny
 * nie uruchomił wysyłki, ustaw na serwerze CRON_SECRET. Vercel sam dołącza
 * nagłówek Authorization: Bearer <CRON_SECRET>.
 *
 * Zmienne:
 * - CRON_SECRET
 * - SMSAPI_TOKEN
 * - SMSAPI_FROM (opcjonalnie, nazwa nadawcy z panelu SMSAPI)
 * - SMSAPI_TEST=1 (opcjonalnie, bez prawdziwej wysyłki)
 * - SERVICE_EMAIL i SERVICE_PASSWORD albo już ustawione NEXT_PUBLIC_SERVICE_EMAIL
 *   i NEXT_PUBLIC_SERVICE_PASSWORD (logowanie do Firestore)
 *
 * ?podglad=1 — tylko lista klientów, bez wysyłki i bez zapisu w bazie.
 */
import { timingSafeEqual } from "crypto";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { headers } from "next/headers";
import { KOLEKCJE } from "@/lib/collections";
import { otworzBazeSerwisanta } from "@/lib/firebaseServer";
import { wyslijSms } from "@/lib/smsapi";
import { czyPoraNaPrzypomnienie, dzisWWarszawie, numerDoSms, trescPrzypomnienia } from "@/lib/smsPrzypomnienie";

export const maxDuration = 60;

function blad(tekst: string, status: number) {
  return Response.json({ blad: tekst }, { status });
}

function tekst(wartosc: unknown) {
  return typeof wartosc === "string" ? wartosc.trim() : "";
}

function secretZgodny(podany: string, oczekiwany: string) {
  const a = Buffer.from(podany);
  const b = Buffer.from(oczekiwany);
  return a.length === b.length && timingSafeEqual(a, b);
}

function cronDozwolony(naglowek: string) {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  if (!secret) {
    return false;
  }
  const dopasowanie = /^Bearer\s+(\S+)$/i.exec(naglowek.trim());
  return Boolean(dopasowanie?.[1] && secretZgodny(dopasowanie[1], secret));
}

export async function GET(request: Request) {
  const naglowki = await headers();
  if (!cronDozwolony(naglowki.get("authorization") ?? "")) {
    return blad("Brak uprawnień.", 401);
  }

  if (!process.env.SMSAPI_TOKEN?.trim()) {
    return blad("Brak tokenu SMSAPI na serwerze.", 503);
  }

  const nadawca = process.env.SMSAPI_FROM?.trim() ?? "";
  if (nadawca.length > 11) {
    return blad("Nazwa nadawcy SMSAPI może mieć najwyżej 11 znaków.", 503);
  }

  const podglad = new URL(request.url).searchParams.get("podglad") === "1";
  const dzisiaj = dzisWWarszawie();

  let sesja: Awaited<ReturnType<typeof otworzBazeSerwisanta>> | null = null;
  try {
    sesja = await otworzBazeSerwisanta();
  } catch (error) {
    const komunikat = error instanceof Error ? error.message : "Nie udało się otworzyć bazy klientów.";
    return blad(komunikat, 503);
  }

  if (!sesja) {
    return blad("Brak danych logowania serwisanta na serwerze.", 503);
  }

  const wyslano: { klientId: string; nazwa: string }[] = [];
  const doWyslania: { klientId: string; nazwa: string; termin: string }[] = [];
  const bledy: { klientId: string; powod: string }[] = [];
  let sprawdzono = 0;
  let pominieto = 0;

  try {
    const snapshot = await getDocs(collection(sesja.db, KOLEKCJE.klienci));
    for (const dokument of snapshot.docs) {
      sprawdzono += 1;
      const dane = dokument.data();
      const decyzja = czyPoraNaPrzypomnienie(
        tekst(dane.dataOstatniegoPrzegladu),
        dzisiaj,
        tekst(dane.smsPrzypomnienieDlaDaty),
      );
      if (!decyzja.wyslac) {
        pominieto += 1;
        continue;
      }

      const nazwa = tekst(dane.imieNazwisko) || tekst(dane.nazwaFirmy) || dokument.id;
      const numer = numerDoSms(tekst(dane.telefon));
      if (!numer) {
        bledy.push({ klientId: dokument.id, powod: "Brak prawidłowego numeru telefonu." });
        continue;
      }

      if (podglad) {
        doWyslania.push({ klientId: dokument.id, nazwa, termin: decyzja.terminPrzegladu });
        continue;
      }

      let wynik: { id: string };
      try {
        wynik = await wyslijSms(numer, trescPrzypomnienia(decyzja.terminPrzegladu));
      } catch (error) {
        const powod = error instanceof Error ? error.message : "Nie udało się wysłać SMS.";
        bledy.push({ klientId: dokument.id, powod });
        continue;
      }

      try {
        await updateDoc(doc(sesja.db, KOLEKCJE.klienci, dokument.id), {
          smsPrzypomnienieDlaDaty: decyzja.dataPrzegladu,
          smsPrzypomnienieWyslano: new Date().toISOString(),
          smsPrzypomnienieId: wynik.id,
        });
        wyslano.push({ klientId: dokument.id, nazwa });
      } catch {
        bledy.push({
          klientId: dokument.id,
          powod: "SMS wysłany, ale nie udało się zapisać potwierdzenia. Jutro system może wysłać wiadomość ponownie.",
        });
      }
    }
  } catch (error) {
    const komunikat = error instanceof Error ? error.message : "Nie udało się odczytać klientów.";
    return blad(komunikat, 500);
  } finally {
    await sesja.zamknij();
  }

  return Response.json({
    dzisiaj,
    podglad,
    sprawdzono,
    pominieto,
    wyslano,
    doWyslania,
    bledy,
  });
}
