"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { CandleSeries } from "@/lib/marketData";

const SYMBOLS = ["SPY", "META", "GLD"] as const;

const MA_LINES = [
  { key: "sma20" as const, label: "MA 20", color: "#EAB308" },
  { key: "sma40" as const, label: "MA 40", color: "#F23645" },
  { key: "sma100" as const, label: "MA 100", color: "#089981" },
];

function toLinePoints(
  candles: CandleSeries["candles"],
  values: (number | null)[]
) {
  return candles
    .map((c, i) => ({ time: c.time as unknown as UTCTimestamp, value: values[i] }))
    .filter(
      (p): p is { time: UTCTimestamp; value: number } => p.value !== null
    );
}

export function CandleChart() {
  const [symbol, setSymbol] = useState<(typeof SYMBOLS)[number]>("SPY");
  const [data, setData] = useState<CandleSeries | null>(null);
  const [loading, setLoading] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const maSeriesRef = useRef<Record<string, ISeriesApi<"Line">>>({});

  // Crea el gráfico una sola vez.
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#828594",
        fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#2A2E39" },
        horzLines: { color: "#2A2E39" },
      },
      rightPriceScale: { borderColor: "#2A2E39" },
      timeScale: { borderColor: "#2A2E39" },
      height: 380,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#089981",
      downColor: "#F23645",
      borderVisible: false,
      wickUpColor: "#089981",
      wickDownColor: "#F23645",
    });

    const maSeries: Record<string, ISeriesApi<"Line">> = {};
    for (const ma of MA_LINES) {
      maSeries[ma.key] = chart.addLineSeries({
        color: ma.color,
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
    }

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    maSeriesRef.current = maSeries;

    const resize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Carga los datos cada vez que cambia el símbolo.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const res = await fetch(`/api/candles?symbol=${symbol}`);
        const json: CandleSeries = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  // Pinta los datos en el gráfico cuando llegan.
  useEffect(() => {
    if (!data || !candleSeriesRef.current) return;

    candleSeriesRef.current.setData(
      data.candles.map((c) => ({
        time: c.time as unknown as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    for (const ma of MA_LINES) {
      const series = maSeriesRef.current[ma.key];
      if (series) series.setData(toLinePoints(data.candles, data[ma.key]));
    }

    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {SYMBOLS.map((s) => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              className={`rounded px-3 py-1.5 font-mono text-xs transition-colors ${
                s === symbol
                  ? "bg-gold text-bg"
                  : "bg-input text-text-soft hover:text-text"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex gap-3 font-mono text-[11px] text-text-soft">
          {MA_LINES.map((ma) => (
            <span key={ma.key} className="flex items-center gap-1.5">
              <span
                className="inline-block h-[2px] w-3"
                style={{ backgroundColor: ma.color }}
              />
              {ma.label}
            </span>
          ))}
        </div>
      </div>

      <div ref={containerRef} className="w-full" />

      {loading && (
        <p className="mt-2 font-mono text-xs text-text-soft">Cargando…</p>
      )}
      {!loading && data?.error && (
        <p className="mt-2 font-mono text-xs text-red">
          Sin datos por ahora ({data.error}).
        </p>
      )}
      {!loading && data && !data.error && data.candles.length === 0 && (
        <p className="mt-2 font-mono text-xs text-text-soft">
          Sin velas para mostrar todavía.
        </p>
      )}
    </div>
  );
}
