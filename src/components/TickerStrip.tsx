"use client";

import { useEffect, useState } from "react";
import type { Quote } from "@/lib/marketData";

const FREE_SYMBOLS = ["SPY", "QQQ", "META", "GLD"];
// Solo un grupo bloqueado (Alejo pidió quitar "Nasdaq" y dejar uno).
const LOCKED_GROUPS = ["S&P 500"];

// Identidad visual por símbolo — un tinte de color y el mismo color para
// la marca de agua del ticker de fondo. A pedido de Alejo: que cada
// tarjeta "no sea tan plana", que muestre el símbolo de fondo. Se hace con
// CSS (tinte + texto gigante translúcido), sin imágenes: más liviano para
// la portada y sin usar logos de marca registrada.
const SYMBOL_STYLE: Record<string, { tint: string; glow: string }> = {
  SPY: { tint: "rgba(8,153,129,0.22)", glow: "#089981" }, // verde S&P
  QQQ: { tint: "rgba(124,92,246,0.22)", glow: "#7C5CF6" }, // morado tech
  META: { tint: "rgba(24,119,242,0.24)", glow: "#3B82F6" }, // azul Meta
  GLD: { tint: "rgba(212,175,55,0.26)", glow: "#D4AF37" }, // dorado oro
};
const DEFAULT_STYLE = { tint: "rgba(130,133,148,0.18)", glow: "#828594" };

const PLACEHOLDER: Quote[] = FREE_SYMBOLS.map((symbol) => ({
  symbol,
  price: null,
  change: null,
  percentChange: null,
  isMarketOpen: null,
}));

export function TickerStrip() {
  const [quotes, setQuotes] = useState<Quote[]>(PLACEHOLDER);
  // Si ya hay suscripción activa, el servidor lo dice aquí — nunca se decide
  // en el navegador. Empieza en `false` (lado seguro) hasta que responda.
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/quotes");
        const data = await res.json();
        if (!cancelled) {
          if (Array.isArray(data.quotes)) setQuotes(data.quotes);
          setAllowed(Boolean(data.allowed));
        }
      } catch {
        // Se queda con el último valor conocido (o el placeholder) si falla la red.
      }
    }

    load();
    // Cada refresco cuesta ~1 crédito de Twelve Data por símbolo (3 aquí).
    // A 30s esta sola tira gastaba ~360 créditos/hora — con el plan
    // gratuito (800/día) eso agota el día en un par de horas con una sola
    // pestaña abierta (pasó de verdad el 15 de sept. de 2026). 5 minutos
    // baja el gasto a ~36 créditos/hora y sigue siendo un precio razonablemente
    // fresco para una tira informativa. Al subir a un plan pago de Twelve
    // Data (quita el límite diario) esto se puede achicar de nuevo.
    const id = setInterval(load, 5 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-5">
      {quotes.map((q) => {
        const style = SYMBOL_STYLE[q.symbol] ?? DEFAULT_STYLE;
        return (
          <div
            key={q.symbol}
            className="relative flex flex-col gap-1 overflow-hidden bg-panel px-4 py-3"
          >
            {/* Tinte de marca en la esquina */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(130% 120% at 100% 0%, ${style.tint}, transparent 62%)`,
              }}
            />
            {/* Marca de agua: el símbolo gigante de fondo */}
            <span
              aria-hidden
              className="pointer-events-none absolute -bottom-2 -right-1 select-none font-sans text-[42px] font-extrabold leading-none tracking-tight"
              style={{ color: style.glow, opacity: 0.14 }}
            >
              {q.symbol}
            </span>
            <span className="relative font-sans text-[15px] font-semibold tracking-tight text-text">
              {q.symbol}
            </span>
            {q.price != null ? (
              <span className="relative flex items-baseline gap-2 font-mono text-xs">
                <span className="text-text">{q.price.toFixed(2)}</span>
                <span className={(q.change ?? 0) >= 0 ? "text-green" : "text-red"}>
                  {(q.change ?? 0) >= 0 ? "+" : ""}
                  {q.percentChange?.toFixed(2)}%
                </span>
              </span>
            ) : (
              <span className="relative text-[11px] font-medium uppercase tracking-wide text-green">
                Gratis
              </span>
            )}
          </div>
        );
      })}
      {LOCKED_GROUPS.map((sym) => (
        <div
          key={sym}
          className={`relative flex flex-col gap-1 overflow-hidden bg-panel px-4 py-3 ${allowed ? "" : "opacity-70"}`}
        >
          <span className="font-sans text-[15px] font-semibold tracking-tight text-text">
            {sym}
          </span>
          {allowed ? (
            <span className="text-[11px] font-medium uppercase tracking-wide text-green">
              Desbloqueado
            </span>
          ) : (
            <span className="text-[11px] font-medium uppercase tracking-wide text-gold">
              Con suscripción
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
