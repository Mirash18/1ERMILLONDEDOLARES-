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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/quotes");
        const data = await res.json();
        if (!cancelled && Array.isArray(data.quotes)) {
          setQuotes(data.quotes);
        }
      } catch {
        // Se queda con el último valor conocido (o el placeholder) si falla la red.
      }
    }

    load();
    const id = setInterval(load, 30_000);
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
          className="flex flex-col gap-1 bg-panel px-4 py-3 opacity-70"
        >
          <span className="font-mono text-sm font-medium text-text">
            {sym}
          </span>
          <span className="text-[11px] uppercase tracking-wide text-gold">
            Con suscripción
          </span>
        </div>
      ))}
    </div>
  );
}
