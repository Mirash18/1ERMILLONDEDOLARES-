"use client";

import { useEffect, useState } from "react";
import type { Quote } from "@/lib/marketData";

const FREE_SYMBOLS = ["SPY", "META", "GLD"];
const LOCKED_GROUPS = ["S&P 500", "Nasdaq"];

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
      {quotes.map((q) => (
        <div key={q.symbol} className="flex flex-col gap-1 bg-panel px-4 py-3">
          <span className="font-mono text-sm font-medium text-text">
            {q.symbol}
          </span>
          {q.price != null ? (
            <span className="flex items-baseline gap-2 font-mono text-xs">
              <span className="text-text">{q.price.toFixed(2)}</span>
              <span
                className={
                  (q.change ?? 0) >= 0 ? "text-green" : "text-red"
                }
              >
                {(q.change ?? 0) >= 0 ? "+" : ""}
                {q.percentChange?.toFixed(2)}%
              </span>
            </span>
          ) : (
            <span className="text-[11px] uppercase tracking-wide text-green">
              Gratis
            </span>
          )}
        </div>
      ))}
      {LOCKED_GROUPS.map((sym) => (
        <div
          key={sym}
          className={`flex flex-col gap-1 bg-panel px-4 py-3 ${allowed ? "" : "opacity-70"}`}
        >
          <span className="font-mono text-sm font-medium text-text">
            {sym}
          </span>
          {allowed ? (
            <span className="text-[11px] uppercase tracking-wide text-green">
              Desbloqueado
            </span>
          ) : (
            <span className="text-[11px] uppercase tracking-wide text-gold">
              Con suscripción
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
