"use client";

import { useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";

type PodpisNaEkranieProps = {
  tytul?: string;
  opis?: string;
  onChange: (podpis: string) => void;
};

type PunktPodpisu = { x: number; y: number; time: number; color?: string };

type PlotnoPodpisu = {
  minWidth: number;
  maxWidth: number;
  _canvas: HTMLCanvasElement;
  _ctx: CanvasRenderingContext2D;
  _createPoint: (x: number, y: number, time?: number) => PunktPodpisu;
  _punktZrodlowy?: PlotnoPodpisu["_createPoint"];
};

function czyPoziomo() {
  return window.innerWidth > window.innerHeight;
}

function podlaczPalec(pad: PlotnoPodpisu) {
  if (!pad._punktZrodlowy) {
    pad._punktZrodlowy = pad._createPoint;
  }
  const zrodlo = pad._punktZrodlowy;
  pad._createPoint = function (this: PlotnoPodpisu, x: number, y: number, time?: number) {
    const canvas = this._canvas;
    const rect = canvas.getBoundingClientRect();
    const skalaX = rect.width > 0 ? canvas.width / rect.width : 1;
    const skalaY = rect.height > 0 ? canvas.height / rect.height : 1;
    this._ctx.setTransform(1, 0, 0, 1, 0, 0);
    return zrodlo.call(this, (x - rect.left) * skalaX + rect.left, (y - rect.top) * skalaY + rect.top, time);
  };
}

function dopasujPlotno(pad: SignatureCanvas) {
  const wewnetrzny = pad.getSignaturePad() as unknown as PlotnoPodpisu;
  const canvas = wewnetrzny._canvas;
  const rect = canvas.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) {
    return;
  }

  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  const ctx = wewnetrzny._ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  if (canvas.width !== width || canvas.height !== height) {
    const stare = pad.toData();
    const skalaX = canvas.width > 0 ? width / canvas.width : 1;
    const skalaY = canvas.height > 0 ? height / canvas.height : 1;
    canvas.width = width;
    canvas.height = height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (stare.length > 0) {
      const przeskalowane = stare.map((grupa) =>
        grupa.map((punkt) => ({
          ...punkt,
          x: punkt.x * skalaX,
          y: punkt.y * skalaY,
        })),
      );
      pad.fromData(przeskalowane as Parameters<SignatureCanvas["fromData"]>[0]);
    }
  }

  wewnetrzny.minWidth = 1.6 * ratio;
  wewnetrzny.maxWidth = 3.2 * ratio;
  podlaczPalec(wewnetrzny);
}

export function PodpisNaEkranie({
  tytul = "Podpis klienta",
  opis = "Opcjonalnie. Podaj telefon klientowi, żeby podpisał się palcem. Podpis trafi nad kreskę w protokole.",
  onChange,
}: PodpisNaEkranieProps) {
  const plotno = useRef<SignatureCanvas>(null);
  const ramka = useRef<HTMLDivElement>(null);
  const [otwarty, setOtwarty] = useState(false);
  const [poziomo, setPoziomo] = useState(false);
  const [podpis, setPodpis] = useState("");

  useEffect(() => {
    if (!otwarty) {
      return;
    }

    const odswiez = () => setPoziomo(czyPoziomo());
    odswiez();
    window.addEventListener("resize", odswiez);
    return () => window.removeEventListener("resize", odswiez);
  }, [otwarty]);

  useEffect(() => {
    if (!otwarty) {
      return;
    }

    const html = document.documentElement;
    const poprzedniHtml = html.style.overflow;
    const poprzedniBody = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = poprzedniHtml;
      document.body.style.overflow = poprzedniBody;
    };
  }, [otwarty]);

  useEffect(() => {
    if (!otwarty || !poziomo) {
      return;
    }

    const skaluj = () => {
      const pad = plotno.current;
      if (!pad) {
        return;
      }
      dopasujPlotno(pad);
    };

    const klatka = requestAnimationFrame(skaluj);
    window.addEventListener("resize", skaluj);
    window.visualViewport?.addEventListener("resize", skaluj);
    window.visualViewport?.addEventListener("scroll", skaluj);
    const obserwator = new ResizeObserver(skaluj);
    if (ramka.current) {
      obserwator.observe(ramka.current);
    }

    return () => {
      cancelAnimationFrame(klatka);
      window.removeEventListener("resize", skaluj);
      window.visualViewport?.removeEventListener("resize", skaluj);
      window.visualViewport?.removeEventListener("scroll", skaluj);
      obserwator.disconnect();
    };
  }, [otwarty, poziomo]);

  function otworz() {
    setPoziomo(czyPoziomo());
    setOtwarty(true);
  }

  function zamknij() {
    setOtwarty(false);
  }

  function wyczysc() {
    plotno.current?.clear();
  }

  function zapisz() {
    const pad = plotno.current;
    if (!pad || pad.isEmpty()) {
      setPodpis("");
      onChange("");
      setOtwarty(false);
      return;
    }

    const obraz = pad.getTrimmedCanvas().toDataURL("image/png");
    setPodpis(obraz);
    onChange(obraz);
    setOtwarty(false);
  }

  return (
    <div>
      <h3 className="mt-6 text-sm font-semibold tracking-wide text-slate-900 uppercase">{tytul}</h3>
      <p className="mt-1 text-xs text-slate-500">{opis}</p>
      {podpis ? (
        <img src={podpis} alt={tytul} className="mt-3 h-24 max-w-full rounded-lg border border-slate-300 bg-white object-contain" />
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={otworz}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
        >
          {podpis ? "Zmień podpis" : "Złóż podpis"}
        </button>
        {podpis ? (
          <button
            type="button"
            onClick={() => {
              setPodpis("");
              onChange("");
            }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
          >
            Wyczyść podpis
          </button>
        ) : null}
      </div>

      {otwarty ? (
        <div role="dialog" aria-modal="true" aria-label={tytul} className="fixed inset-0 z-[9999] flex flex-col bg-white">
          {poziomo ? (
            <>
              <div ref={ramka} className="relative min-h-0 flex-1 touch-none">
                <SignatureCanvas
                  ref={plotno}
                  penColor="#0f172a"
                  throttle={0}
                  minDistance={0}
                  velocityFilterWeight={0.2}
                  clearOnResize={false}
                  canvasProps={{
                    className: "absolute inset-0 block h-full w-full touch-none",
                    "aria-label": tytul,
                  }}
                />
              </div>
              <div className="flex gap-2 border-t border-slate-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))]">
                <button type="button" onClick={wyczysc} className="min-h-11 flex-1 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700">
                  Wyczyść
                </button>
                <button type="button" onClick={zamknij} className="min-h-11 flex-1 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700">
                  Zamknij
                </button>
                <button type="button" onClick={zapisz} className="min-h-11 flex-1 rounded-lg bg-slate-900 px-3 text-sm font-medium text-white">
                  Zapisz
                </button>
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-6 px-8 text-center">
              <p className="text-lg font-medium text-slate-900">Aby złożyć podpis, obróć telefon poziomo</p>
              <button
                type="button"
                onClick={zamknij}
                className="min-h-11 rounded-lg border border-slate-200 px-5 text-sm font-medium text-slate-700"
              >
                Anuluj
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
