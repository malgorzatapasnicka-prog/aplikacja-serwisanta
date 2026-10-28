/**
 * Wysyłka protokołu przez SMTP Interii.
 *
 * PDF powstaje na serwerze. Telefon przesyła tylko adres e-mail i identyfikatory,
 * więc duży raport ze zdjęciami nie wpada w limit wielkości żądania Vercela.
 *
 * Na serwerze (Vercel → Settings → Environment Variables) ustaw:
 * - EMAIL_USER — pełny adres skrzynki Interia, np. radwin@interia.eu
 * - EMAIL_PASS — hasło do tej skrzynki
 *
 * Host SMTP: poczta.interia.pl, port 465, połączenie szyfrowane (SSL).
 */
import nodemailer from "nodemailer";
import { nazwaPlikuPdf } from "@/lib/daneProtokolu";
import { FIRMA } from "@/lib/firma";
import { BladPdf, utworzPdfDlaProtokolu } from "@/lib/pdfProtokoluSerwer";

export const maxDuration = 60;

function blad(tekst: string, status: number) {
  return Response.json({ blad: tekst }, { status });
}

function tekst(wartosc: unknown) {
  return typeof wartosc === "string" ? wartosc.trim() : "";
}

export async function POST(request: Request) {
  const uzytkownik = process.env.EMAIL_USER?.trim() || "";
  const haslo = process.env.EMAIL_PASS?.trim() || "";
  if (!uzytkownik || !haslo) {
    return blad("Brak konfiguracji skrzynki e-mail na serwerze.", 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return blad("Nieprawidłowe żądanie.", 400);
  }

  const email = body && typeof body === "object" && "email" in body ? tekst(body.email) : "";
  const klientId = body && typeof body === "object" && "klientId" in body ? tekst(body.klientId) : "";
  const protokolId = body && typeof body === "object" && "protokolId" in body ? tekst(body.protokolId) : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return blad("Podaj prawidłowy adres e-mail.", 400);
  }

  const transporter = nodemailer.createTransport({
    host: "poczta.interia.pl",
    port: 465,
    secure: true,
    auth: {
      user: uzytkownik,
      pass: haslo,
    },
  });

  try {
    const { pdf, nazwaRaportu } = await utworzPdfDlaProtokolu(klientId, protokolId);
    await transporter.sendMail({
      from: uzytkownik,
      to: email,
      subject: nazwaRaportu ? `Protokół: ${nazwaRaportu}` : "Protokół serwisowy",
      html: `<p>Dzień dobry,</p>
<p>w załączniku przesyłamy protokół z wizyty serwisowej.</p>
<p>${FIRMA.nazwa} ${FIRMA.wlasciciel}<br>
${FIRMA.ulica}, ${FIRMA.kod}<br>
tel. ${FIRMA.telefon}</p>`,
      attachments: [
        {
          filename: nazwaPlikuPdf(nazwaRaportu),
          content: pdf,
          contentType: "application/pdf",
        },
      ],
    });
  } catch (error) {
    if (error instanceof BladPdf) {
      return blad(error.message, error.status);
    }
    const komunikat = error instanceof Error ? error.message : "Nie udało się wysłać wiadomości.";
    return blad(komunikat, 500);
  }

  return Response.json({ ok: true });
}
