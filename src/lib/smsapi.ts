export type WynikSms = {
  id: string;
};

type OdpowiedzSmsApi = {
  error?: number;
  message?: string;
  list?: Array<{ id?: string; error?: string | null; status?: string }>;
};

/**
 * Wysyłka przez SMSAPI (https://api.smsapi.pl).
 *
 * SMSAPI_TOKEN — token OAuth z panelu SMSAPI (Ustawienia → API).
 * SMSAPI_FROM — opcjonalna nazwa nadawcy zatwierdzona w panelu (do 11 znaków).
 *              Puste pole zostawia nadawcę domyślnego z konta SMSAPI.
 * SMSAPI_TEST=1 — SMSAPI sprawdza żądanie, ale nie wysyła wiadomości i nie pobiera punktów.
 */
export async function wyslijSms(numer: string, tresc: string): Promise<WynikSms> {
  const token = process.env.SMSAPI_TOKEN?.trim() ?? "";
  if (!token) {
    throw new Error("Brak tokenu SMSAPI na serwerze.");
  }

  const nadawca = process.env.SMSAPI_FROM?.trim() ?? "";
  if (nadawca.length > 11) {
    throw new Error("Nazwa nadawcy SMSAPI może mieć najwyżej 11 znaków.");
  }

  const parametry = new URLSearchParams({
    to: numer,
    message: tresc,
    format: "json",
    encoding: "utf-8",
  });
  if (nadawca) {
    parametry.set("from", nadawca);
  }
  if (process.env.SMSAPI_TEST?.trim() === "1") {
    parametry.set("test", "1");
  }

  const odpowiedz = await fetch("https://api.smsapi.pl/sms.do", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: parametry,
  });

  const dane = (await odpowiedz.json().catch(() => null)) as OdpowiedzSmsApi | null;
  if (!odpowiedz.ok || !dane || typeof dane.error === "number") {
    const opis = dane?.message?.trim() || `SMSAPI odrzuciło wysyłkę (kod ${odpowiedz.status}).`;
    throw new Error(opis);
  }

  const pozycja = dane.list?.[0];
  if (!pozycja?.id || pozycja.error) {
    throw new Error(pozycja?.error?.trim() || "SMSAPI nie przyjęło wiadomości.");
  }

  return { id: pozycja.id };
}
