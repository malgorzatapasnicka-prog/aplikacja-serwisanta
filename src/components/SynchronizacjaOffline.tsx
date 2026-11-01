"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { ZDARZENIE_KOLEJKI, liczbaProtokolowWKolejce, przetworzKolejkePlikow } from "@/lib/kolejkaPlikow";

const CO_ILE_PROBOWAC_MS = 30_000;

function subskrybujSiec(odswiez: () => void) {
  window.addEventListener("online", odswiez);
  window.addEventListener("offline", odswiez);
  return () => {
    window.removeEventListener("online", odswiez);
    window.removeEventListener("offline", odswiez);
  };
}

function czyOnline() {
  return navigator.onLine;
}

/**
 * Rejestruje service worker (otwieranie aplikacji bez internetu), wysyła zdjęcia zapisane w telefonie
 * po odzyskaniu sieci i pokazuje pasek ze stanem połączenia.
 */
export function SynchronizacjaOffline() {
  const online = useSyncExternalStore(subskrybujSiec, czyOnline, () => true);
  const [oczekujace, setOczekujace] = useState(0);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
        console.error("Nie udało się włączyć trybu offline:", error);
      });
    }
  }, []);

  useEffect(() => {
    let aktywny = true;

    async function odswiezLiczbe() {
      const liczba = await liczbaProtokolowWKolejce();
      if (aktywny) {
        setOczekujace(liczba);
      }
    }

    async function synchronizuj() {
      await przetworzKolejkePlikow();
      await odswiezLiczbe();
    }

    const poPowrocieDoAplikacji = () => {
      if (document.visibilityState === "visible") {
        void synchronizuj();
      }
    };

    void synchronizuj();
    const zegar = setInterval(() => void synchronizuj(), CO_ILE_PROBOWAC_MS);
    window.addEventListener("online", poPowrocieDoAplikacji);
    window.addEventListener(ZDARZENIE_KOLEJKI, odswiezLiczbe);
    document.addEventListener("visibilitychange", poPowrocieDoAplikacji);

    return () => {
      aktywny = false;
      clearInterval(zegar);
      window.removeEventListener("online", poPowrocieDoAplikacji);
      window.removeEventListener(ZDARZENIE_KOLEJKI, odswiezLiczbe);
      document.removeEventListener("visibilitychange", poPowrocieDoAplikacji);
    };
  }, []);

  if (online && oczekujace === 0) {
    return null;
  }

  return (
    <div
      role="status"
      className="print:hidden fixed inset-x-0 bottom-0 z-[60] border-t border-amber-300 bg-amber-50 px-4 py-2.5 text-center text-sm font-medium text-amber-950 shadow-lg"
    >
      {online
        ? `Wysyłanie zdjęć do chmury (protokoły: ${oczekujace}). Nie zamykaj aplikacji.`
        : oczekujace > 0
          ? `Tryb offline. Protokoły i zdjęcia (${oczekujace}) czekają w telefonie i wyślą się po odzyskaniu sieci.`
          : "Tryb offline. Zmiany zapisują się w telefonie i wyślą się same po odzyskaniu sieci."}
    </div>
  );
}
