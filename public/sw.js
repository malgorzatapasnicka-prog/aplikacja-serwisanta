/* Service worker aplikacji serwisanta: pozwala otworzyć aplikację bez internetu. */
/* Dane (klienci, protokoły) obsługuje pamięć Firestore w telefonie, tu zapisujemy tylko samą aplikację. */

const WERSJA = "v1";
const NAZWA_STRON = `strony-${WERSJA}`;
const NAZWA_ZASOBOW = `zasoby-${WERSJA}`;
const STRONY_APLIKACJI = ["/", "/klienci", "/zlecenia", "/zamowienia-czesci", "/magazyn", "/rozliczenia"];
const CZAS_NA_SIEC_MS = 4000;
const MAKS_ZASOBOW = 400;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      await Promise.all(
        STRONY_APLIKACJI.map(async (adres) => {
          try {
            const odpowiedz = await fetch(adres, { credentials: "same-origin", cache: "reload" });
            await zapamietajStrone(adres, odpowiedz);
          } catch {
            // brak sieci przy instalacji: strona zapamięta się przy pierwszym otwarciu
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const nazwy = await caches.keys();
      await Promise.all(
        nazwy
          .filter((nazwa) => nazwa !== NAZWA_STRON && nazwa !== NAZWA_ZASOBOW)
          .map((nazwa) => caches.delete(nazwa)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Zapisuje stronę oraz wszystkie skrypty, style i czcionki, do których odwołuje się jej kod. */
async function zapamietajStrone(adres, odpowiedz) {
  if (!odpowiedz || !odpowiedz.ok) {
    return;
  }
  const kopia = odpowiedz.clone();
  const cache = await caches.open(NAZWA_STRON);
  await cache.put(new URL(adres, self.location.origin).pathname, odpowiedz);

  let tekst = "";
  try {
    tekst = await kopia.text();
  } catch {
    return;
  }
  const znalezione = new Set();
  const wzorzec = /(?:\/_next\/)?(static\/[A-Za-z0-9_\-./%~[\]]+?\.(?:js|css|woff2|woff|ttf))/g;
  let dopasowanie = wzorzec.exec(tekst);
  while (dopasowanie) {
    znalezione.add(`/_next/${dopasowanie[1]}`);
    dopasowanie = wzorzec.exec(tekst);
  }

  const zasoby = await caches.open(NAZWA_ZASOBOW);
  await Promise.all(
    [...znalezione].map(async (zasob) => {
      try {
        if (await zasoby.match(zasob)) {
          return;
        }
        const wynik = await fetch(zasob, { credentials: "same-origin" });
        if (wynik.ok) {
          await zasoby.put(zasob, wynik);
        }
      } catch {
        // pojedynczy brakujący plik nie może przerwać zapamiętywania reszty
      }
    }),
  );
  await przytnijCache(zasoby);
}

async function przytnijCache(cache) {
  const klucze = await cache.keys();
  if (klucze.length <= MAKS_ZASOBOW) {
    return;
  }
  await Promise.all(klucze.slice(0, klucze.length - MAKS_ZASOBOW).map((klucz) => cache.delete(klucz)));
}

function zSieciZLimitem(zadanie) {
  return new Promise((resolve, reject) => {
    const limit = setTimeout(() => reject(new Error("limit czasu")), CZAS_NA_SIEC_MS);
    fetch(zadanie).then(
      (odpowiedz) => {
        clearTimeout(limit);
        resolve(odpowiedz);
      },
      (blad) => {
        clearTimeout(limit);
        reject(blad);
      },
    );
  });
}

async function obsluzNawigacje(event) {
  const adres = new URL(event.request.url);
  try {
    const odpowiedz = await zSieciZLimitem(event.request);
    event.waitUntil(zapamietajStrone(adres.pathname, odpowiedz.clone()));
    return odpowiedz;
  } catch {
    const cache = await caches.open(NAZWA_STRON);
    return (
      (await cache.match(adres.pathname)) ||
      (await cache.match("/")) ||
      new Response("Brak internetu, a ta strona nie została jeszcze zapisana w telefonie.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

async function zasobZCache(event) {
  const cache = await caches.open(NAZWA_ZASOBOW);
  const zapisany = await cache.match(event.request);
  if (zapisany) {
    return zapisany;
  }
  const odpowiedz = await fetch(event.request);
  if (odpowiedz.ok) {
    event.waitUntil(cache.put(event.request, odpowiedz.clone()));
  }
  return odpowiedz;
}

async function zasobZOdswiezaniem(event) {
  const cache = await caches.open(NAZWA_ZASOBOW);
  const zapisany = await cache.match(event.request);
  const zSieci = fetch(event.request)
    .then((odpowiedz) => {
      if (odpowiedz.ok) {
        cache.put(event.request, odpowiedz.clone());
      }
      return odpowiedz;
    })
    .catch(() => undefined);
  if (zapisany) {
    event.waitUntil(zSieci);
    return zapisany;
  }
  return (await zSieci) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const zadanie = event.request;
  if (zadanie.method !== "GET") {
    return;
  }
  const adres = new URL(zadanie.url);
  if (adres.origin !== self.location.origin || adres.pathname.startsWith("/api/")) {
    return;
  }

  if (zadanie.mode === "navigate") {
    event.respondWith(obsluzNawigacje(event));
    return;
  }

  if (adres.pathname.startsWith("/_next/static/")) {
    event.respondWith(zasobZCache(event));
    return;
  }

  if (/\.(?:png|jpg|jpeg|svg|ico|webp|woff2?|webmanifest)$/.test(adres.pathname)) {
    event.respondWith(zasobZOdswiezaniem(event));
  }
});
