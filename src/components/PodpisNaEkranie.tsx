"use client";

import { PointerEvent, useEffect, useRef, useState } from "react";

type PodpisNaEkranieProps = {
  onChange: (podpis: string) => void;
};

export function PodpisNaEkranie({ onChange }: PodpisNaEkranieProps) {
  const plotno = useRef<HTMLCanvasElement>(null);
  const rysuje = useRef(false);
  const ostatni = useRef({ x: 0, y: 0 });
  const [jestPodpis, setJestPodpis] = useState(false);

  useEffect(() => {
    const canvas = plotno.current;
    if (!canvas) {
      return;
    }
    const skala = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * skala);
    canvas.height = Math.round(160 * skala);
    canvas.getContext("2d")?.scale(skala, skala);
  }, []);

  function punkt(event: PointerEvent<HTMLCanvasElement>) {
    const ramka = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - ramka.left, y: event.clientY - ramka.top };
  }

  function pedzel(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return null;
    }
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    return ctx;
  }

  function start(event: PointerEvent<HTMLCanvasElement>) {
    const ctx = pedzel(event.currentTarget);
    if (!ctx) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    rysuje.current = true;
    ostatni.current = punkt(event);
    ctx.beginPath();
    ctx.moveTo(ostatni.current.x, ostatni.current.y);
  }

  function rusz(event: PointerEvent<HTMLCanvasElement>) {
    if (!rysuje.current) {
      return;
    }
    const ctx = pedzel(event.currentTarget);
    if (!ctx) {
      return;
    }
    const teraz = punkt(event);
    ctx.beginPath();
    ctx.moveTo(ostatni.current.x, ostatni.current.y);
    ctx.lineTo(teraz.x, teraz.y);
    ctx.stroke();
    ostatni.current = teraz;
  }

  function koniec() {
    if (!rysuje.current) {
      return;
    }
    rysuje.current = false;
    const canvas = plotno.current;
    if (!canvas) {
      return;
    }
    const podpis = wytnijPodpis(canvas);
    setJestPodpis(Boolean(podpis));
    onChange(podpis);
  }

  function wyczysc() {
    const canvas = plotno.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    setJestPodpis(false);
    onChange("");
  }

  return (
    <div>
      <h3 className="mt-6 text-sm font-semibold tracking-wide text-slate-900 uppercase">Podpis klienta</h3>
      <p className="mt-1 text-xs text-slate-500">
        Opcjonalnie. Podaj telefon klientowi, żeby podpisał się palcem. Podpis trafi nad kreskę w protokole.
      </p>
      <canvas
        ref={plotno}
        aria-label="Miejsce na podpis klienta"
        className="mt-3 h-40 w-full touch-none rounded-lg border border-slate-300 bg-white"
        style={{
          backgroundImage: "linear-gradient(#cbd5e1, #cbd5e1)",
          backgroundSize: "100% 1px",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center bottom 28px",
        }}
        onPointerDown={start}
        onPointerMove={rusz}
        onPointerUp={koniec}
        onPointerCancel={koniec}
      />
      {jestPodpis ? (
        <button
          type="button"
          onClick={wyczysc}
          className="mt-3 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
        >
          Wyczyść podpis
        </button>
      ) : null}
    </div>
  );
}

function wytnijPodpis(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return "";
  }
  const { width, height } = canvas;
  const piksele = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let jest = false;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (piksele[(y * width + x) * 4 + 3] <= 10) {
        continue;
      }
      jest = true;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (!jest) {
    return "";
  }
  const margines = 12;
  minX = Math.max(0, minX - margines);
  minY = Math.max(0, minY - margines);
  maxX = Math.min(width - 1, maxX + margines);
  maxY = Math.min(height - 1, maxY + margines);
  const szerokosc = maxX - minX + 1;
  const wysokosc = maxY - minY + 1;
  const wycinek = document.createElement("canvas");
  wycinek.width = szerokosc;
  wycinek.height = wysokosc;
  wycinek.getContext("2d")?.drawImage(canvas, minX, minY, szerokosc, wysokosc, 0, 0, szerokosc, wysokosc);
  return wycinek.toDataURL("image/png");
}
