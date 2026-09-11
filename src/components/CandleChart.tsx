"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { CandleSeries } from "@/lib/marketData";

const SYMBOLS = ["SPY", "META", "GLD"] as const;

const TIMEFRAMES = [
  { key: "1h", label: "Hora" },
  { key: "1day", label: "Día" },
  { key: "1week", label: "Semana" },
  { key: "1month", label: "Mes" },
] as const;

const MA_LINES = [
  { key: "sma20" as const, label: "MA 20", color: "#EAB308" },
  { key: "sma40" as const, label: "MA 40", color: "#F23645" },
  { key: "sma100" as const, label: "MA 100", color: "#089981" },
  { key: "sma200" as const, label: "MA 200", color: "#A855F7" },
];

const BOLLINGER_COLOR = "#60A5FA";

type Theme = "dark" | "light";

// El tema del gráfico es independiente del tema del sitio: el usuario lo
// puede cambiar aquí mismo para ver fondo negro o blanco en el gráfico.
const PALETTES: Record<
  Theme,
  {
    wrapperBg: string;
    wrapperBorder: string;
    chartBg: string;
    chartText: string;
    watermark: string;
    buttonBg: string;
    buttonText: string;
    buttonActiveBg: string;
    buttonActiveText: string;
    textSoft: string;
  }
> = {
  dark: {
    wrapperBg: "#0B0E14",
    wrapperBorder: "#2A2E39",
    chartBg: "#0B0E14",
    chartText: "#828594",
    watermark: "rgba(255,255,255,0.07)",
    buttonBg: "#1E222D",
    buttonText: "#828594",
    buttonActiveBg: "#D4AF37",
    buttonActiveText: "#0B0E14",
    textSoft: "#828594",
  },
  light: {
    wrapperBg: "#FFFFFF",
    wrapperBorder: "#E2E5EA",
    chartBg: "#FFFFFF",
    chartText: "#6B7280",
    watermark: "rgba(0,0,0,0.06)",
    buttonBg: "#F3F4F6",
    buttonText: "#374151",
    buttonActiveBg: "#D4AF37",
    buttonActiveText: "#FFFFFF",
    textSoft: "#6B7280",
  },
};

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
  const [timeframe, setTimeframe] =
    useState<(typeof TIMEFRAMES)[number]["key"]>("1day");
  const [theme, setTheme] = useState<Theme>("dark");
  const [showVolume, setShowVolume] = useState(true);
  const [showBollinger, setShowBollinger] = useState(false);
  const [data, setData] = useState<CandleSeries | null>(null);
  const [loading, setLoading] = useState(true);

  const palette = PALETTES[theme];

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const maSeriesRef = useRef<Record<string, ISeriesApi<"Line">>>({});
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<"Line"> | null>(null);

  // Crea el gráfico una sola vez. El tema, símbolo y toggles se aplican
  // después con applyOptions/setData, sin recrear el gráfico.
  useEffect(() => {
    if (!containerRef.current) return;
    const initialPalette = PALETTES[theme];

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: initialPalette.chartBg },
        textColor: initialPalette.chartText,
        fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
        fontSize: 11,
      },
      // Sin líneas de cuadrícula — solo las velas, como pidió Alejo.
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      rightPriceScale: { borderColor: initialPalette.wrapperBorder },
      timeScale: { borderColor: initialPalette.wrapperBorder },
      watermark: {
        visible: true,
        text: symbol,
        color: initialPalette.watermark,
        fontSize: 72,
        horzAlign: "center",
        vertAlign: "center",
      },
      height: 420,
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

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "",
      color: "#089981",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    volumeSeries.applyOptions({ visible: showVolume });

    const bbOptions = {
      color: BOLLINGER_COLOR,
      lineWidth: 1 as const,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      visible: showBollinger,
    };
    const bbUpper = chart.addLineSeries(bbOptions);
    const bbLower = chart.addLineSeries(bbOptions);

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    maSeriesRef.current = maSeries;
    volumeSeriesRef.current = volumeSeries;
    bbUpperRef.current = bbUpper;
    bbLowerRef.current = bbLower;

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
    // Se crea una sola vez a propósito — el resto de estado se aplica en
    // los efectos de abajo sin recrear el gráfico.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aplica el tema (fondo, texto, bordes, marca de agua) sin recrear el
  // gráfico — así el cambio de "fondo claro/oscuro" es instantáneo.
  useEffect(() => {
    if (!chartRef.current) return;
    const p = PALETTES[theme];
    chartRef.current.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: p.chartBg },
        textColor: p.chartText,
      },
      rightPriceScale: { borderColor: p.wrapperBorder },
      timeScale: { borderColor: p.wrapperBorder },
      watermark: { color: p.watermark },
    });
  }, [theme]);

  // La marca de agua muestra siempre el símbolo que se está mirando.
  useEffect(() => {
    chartRef.current?.applyOptions({ watermark: { text: symbol } });
  }, [symbol]);

  // Mostrar/ocultar volumen y Bollinger no requiere volver a pedir datos.
  useEffect(() => {
    volumeSeriesRef.current?.applyOptions({ visible: showVolume });
  }, [showVolume]);

  useEffect(() => {
    bbUpperRef.current?.applyOptions({ visible: showBollinger });
    bbLowerRef.current?.applyOptions({ visible: showBollinger });
  }, [showBollinger]);

  // Carga los datos cada vez que cambia el símbolo o el marco de tiempo.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/candles?symbol=${symbol}&interval=${timeframe}`
        );
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
  }, [symbol, timeframe]);

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

    volumeSeriesRef.current?.setData(
      data.candles.map((c) => ({
        time: c.time as unknown as UTCTimestamp,
        value: c.volume,
        color:
          c.close >= c.open ? "rgba(8,153,129,0.5)" : "rgba(242,54,69,0.5)",
      }))
    );

    bbUpperRef.current?.setData(toLinePoints(data.candles, data.bbUpper));
    bbLowerRef.current?.setData(toLinePoints(data.candles, data.bbLower));

    chartRef.current?.timeScale().fitContent();
  }, [data]);

  function toggleStyle(active: boolean) {
    return {
      backgroundColor: active ? palette.buttonActiveBg : palette.buttonBg,
      color: active ? palette.buttonActiveText : palette.buttonText,
    };
  }

  return (
    <div
      className="rounded-lg border p-4 transition-colors"
      style={{
        backgroundColor: palette.wrapperBg,
        borderColor: palette.wrapperBorder,
      }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {SYMBOLS.map((s) => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              className="rounded px-3 py-1.5 font-mono text-xs transition-colors"
              style={toggleStyle(s === symbol)}
            >
              {s}
            </button>
          ))}
          <span
            className="mx-1 hidden w-px self-stretch sm:block"
            style={{ backgroundColor: palette.wrapperBorder }}
          />
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.key}
              onClick={() => setTimeframe(tf.key)}
              className="rounded px-3 py-1.5 font-mono text-xs transition-colors"
              style={toggleStyle(tf.key === timeframe)}
            >
              {tf.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowVolume((v) => !v)}
            className="rounded px-3 py-1.5 font-mono text-xs transition-colors"
            style={toggleStyle(showVolume)}
          >
            Volumen
          </button>
          <button
            onClick={() => setShowBollinger((v) => !v)}
            className="rounded px-3 py-1.5 font-mono text-xs transition-colors"
            style={toggleStyle(showBollinger)}
          >
            Bollinger
          </button>
          <button
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            className="rounded px-3 py-1.5 font-mono text-xs transition-colors"
            style={toggleStyle(false)}
            title="Cambiar fondo del gráfico"
          >
            {theme === "dark" ? "Fondo claro" : "Fondo oscuro"}
          </button>
        </div>
      </div>

      <div
        className="mb-3 flex flex-wrap gap-3 font-mono text-[11px]"
        style={{ color: palette.textSoft }}
      >
        {MA_LINES.map((ma) => (
          <span key={ma.key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-[2px] w-3"
              style={{ backgroundColor: ma.color }}
            />
            {ma.label}
          </span>
        ))}
        {showBollinger && (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-[2px] w-3"
              style={{ backgroundColor: BOLLINGER_COLOR }}
            />
            Bollinger (20, 2σ)
          </span>
        )}
      </div>

      <div ref={containerRef} className="w-full" />

      {loading && (
        <p className="mt-2 font-mono text-xs" style={{ color: palette.textSoft }}>
          Cargando…
        </p>
      )}
      {!loading && data?.error && (
        <p className="mt-2 font-mono text-xs text-red">
          Sin datos por ahora ({data.error}).
        </p>
      )}
      {!loading && data && !data.error && data.candles.length === 0 && (
        <p
          className="mt-2 font-mono text-xs"
          style={{ color: palette.textSoft }}
        >
          Sin velas para mostrar todavía.
        </p>
      )}
    </div>
  );
}
