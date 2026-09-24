"use client";

import { useCallback, useEffect, useState } from "react";
import { CandleChart } from "@/components/CandleChart";
import { TradingRoomHeader } from "@/components/TradingRoomHeader";
import { TradingInfoBar } from "@/components/TradingInfoBar";
import type { Quote } from "@/lib/marketData";

/**
 * Sala de Trading completa: encabezado (acción, precio, cambio), barra de
 * datos (volumen, cierre de ayer, apertura de hoy) y el gráfico.
 *
 * Antes el encabezado y la barra tenían valores fijos en el código (SPY
 * $595.42, volumen 45.2M…) y no cambiaban al elegir otra acción en el
 * gráfico (bug de Alejo). Ahora el gráfico avisa qué acción se mira y aquí
 * se pide su cotización real.
 */
export function TradingRoom() {
  const [symbol, setSymbol] = useState("SPY");
  const [quote, setQuote] = useState<Quote | null>(null);

  // Referencia estable: el gráfico la usa en un efecto.
  const onSymbolChange = useCallback((s: string) => setSymbol(s), []);

  useEffect(() => {
    let cancelled = false;
    // Al cambiar de acción se borra la anterior de inmediato — mejor "—"
    // un instante que mostrar el precio de SPY con el nombre de Netflix.
    setQuote(null);

    async function load() {
      try {
        const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbol)}&scope=sala`);
        const json: { quotes?: Quote[] } = await res.json();
        const q = json.quotes?.find((x) => x.symbol === symbol) ?? null;
        if (!cancelled) setQuote(q);
      } catch {
        if (!cancelled) setQuote(null);
      }
    }

    load();
    // El servidor guarda la cotización 5 min (Redis), así que refrescar
    // cada minuto no gasta créditos de más: casi siempre sale de la caché.
    const id = setInterval(load, 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol]);

  return (
    <div className="flex h-screen flex-col bg-bg">
      <TradingRoomHeader symbol={symbol} quote={quote} />
      <TradingInfoBar quote={quote} />
      <main className="min-h-0 flex-1 overflow-hidden px-3 py-3">
        <CandleChart fillHeight onSymbolChange={onSymbolChange} />
      </main>
    </div>
  );
}
