"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  LineStyle,
  TickMarkType,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { CandleSeries, ExtendedQuote } from "@/lib/marketData";
import type { EarningsInfo } from "@/lib/earnings";
import { FREE_SYMBOLS } from "@/lib/universe";
import { Watchlist } from "./Watchlist";

// A cuántos días o menos de un earning estimado aparece el aviso — no tiene
// caso mostrarlo con meses de anticipación, ver docs/ARQUITECTURA.md.
const EARNINGS_WARNING_DAYS = 21;

const TIMEFRAMES = [
  { key: "1h", label: "Hora" },
  { key: "1day", label: "Día" },
  { key: "1week", label: "Semana" },
  { key: "1month", label: "Mes" },
] as const;

type TimeframeKey = (typeof TIMEFRAMES)[number]["key"];

const MA_LINES = [
  { key: "sma20" as const, label: "MA 20", color: "#EAB308" },
  { key: "sma40" as const, label: "MA 40", color: "#F23645" },
  { key: "sma100" as const, label: "MA 100", color: "#089981" },
  { key: "sma200" as const, label: "MA 200", color: "#A855F7" },
];

const BOLLINGER_COLOR = "#60A5FA";

// Alto fijo del panel del gráfico — se usa tanto para crear el gráfico como
// para no dejar que la insignia de "próxima vela" se salga del panel.
const CHART_HEIGHT = 420;

// Cuánto se separa la insignia de la etiqueta nativa de precio (para no
// quedar encimada) y cuánto ocupa ella misma, para no dejarla salir del
// panel por arriba o por abajo.
const BADGE_GAP_BELOW_PRICE = 18;
const BADGE_HEIGHT_ESTIMATE = 22;

type Theme = "dark" | "light";

export type Palette = {
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
  badgeBg: string;
};

// El tema del gráfico es independiente del tema del sitio: el usuario lo
// puede cambiar aquí mismo para ver fondo negro o blanco en el gráfico.
const PALETTES: Record<Theme, Palette> = {
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
    badgeBg: "rgba(19,23,34,0.85)",
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
    badgeBg: "rgba(255,255,255,0.9)",
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

// Próximo instante (Unix, segundos, UTC) en que se cierra la vela actual y
// arranca la siguiente, según el marco de tiempo elegido.
function nextCandleBoundary(nowSeconds: number, timeframe: TimeframeKey): number {
  const d = new Date(nowSeconds * 1000);
  if (timeframe === "1h") {
    return (Math.floor(nowSeconds / 3600) + 1) * 3600;
  }
  if (timeframe === "1day") {
    return (Math.floor(nowSeconds / 86400) + 1) * 86400;
  }
  if (timeframe === "1week") {
    // Próximo lunes 00:00 UTC.
    const day = d.getUTCDay(); // 0 = domingo … 6 = sábado
    const daysUntilMonday = ((8 - day) % 7) || 7;
    return Math.floor(
      Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate() + daysUntilMonday
      ) / 1000
    );
  }
  // "1month": primer día del mes siguiente, 00:00 UTC.
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000);
}

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

// lightweight-charts rotula el eje de tiempo en UTC. Para las velas intradía
// eso mostraba horas que no le dicen nada al usuario (13:30 en vez de las
// 8:30 de la apertura vistas desde Colombia), así que se pasan a la hora
// local del visitante — que es lo que hacen ProRealTime, Investing y
// TradingView.
//
// Las velas de día, semana y mes vienen marcadas a las 00:00 UTC: pasarlas a
// hora local las correría al día anterior, así que esas se siguen leyendo en
// UTC. Por eso cada formateador recibe si el marco es intradía o no.
function timeParts(time: number, intraday: boolean) {
  const d = new Date(time * 1000);
  return intraday
    ? {
        year: d.getFullYear(),
        month: d.getMonth(),
        day: d.getDate(),
        hours: d.getHours(),
        minutes: d.getMinutes(),
      }
    : {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth(),
        day: d.getUTCDate(),
        hours: d.getUTCHours(),
        minutes: d.getUTCMinutes(),
      };
}

// Etiquetas del eje horizontal.
function formatTickMark(
  time: number,
  tickMarkType: TickMarkType,
  intraday: boolean
): string {
  const t = timeParts(time, intraday);
  switch (tickMarkType) {
    case TickMarkType.Year:
      return String(t.year);
    case TickMarkType.Month:
      return `${MESES[t.month]} ${t.year}`;
    case TickMarkType.DayOfMonth:
      return `${t.day} ${MESES[t.month]}`;
    default:
      return `${pad2(t.hours)}:${pad2(t.minutes)}`;
  }
}

// Etiqueta que aparece al pasar el cursor por una vela: fecha completa, y
// además la hora cuando el marco es intradía.
function formatCrosshairTime(time: number, intraday: boolean): string {
  const t = timeParts(time, intraday);
  const fecha = `${t.day} ${MESES[t.month]} ${t.year}`;
  return intraday ? `${fecha}  ${pad2(t.hours)}:${pad2(t.minutes)}` : fecha;
}

// Cómo se rotula la insignia de fuera de sesión, igual que el "Pre-market"
// de TradingView: antes de abrir dice PRE, después de cerrar dice CIERRE.
const SESSION_LABEL: Record<string, string> = {
  pre: "PRE",
  post: "CIERRE",
  closed: "CIERRE",
};

// Convierte la posición en píxeles del último precio (o null si aún no se
// puede calcular) en el "top" que le corresponde a la insignia, pegada justo
// debajo de esa altura y sin salirse del panel del gráfico.
function clampBadgeTop(priceY: number | null, chartHeight: number): number {
  if (priceY === null) return 8;
  const min = 8;
  const max = chartHeight - BADGE_HEIGHT_ESTIMATE - 8;
  return Math.min(Math.max(priceY + BADGE_GAP_BELOW_PRICE, min), max);
}

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "00:00";
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (days > 0) return `${days}d ${String(hours).padStart(2, "0")}h`;
  if (hours > 0)
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// Menú desplegable de una sola elección (símbolo, marco de tiempo) — un solo
// botón que se expande en vez de una fila de botones sueltos.
function SelectDropdown<K extends string>({
  value,
  options,
  onChange,
  palette,
  align = "left",
  // A partir de este número de opciones aparece un buscador arriba del
  // menú — con 3 símbolos no hace falta, con 300+ (universo pagado) sí.
  searchThreshold = 12,
}: {
  value: K;
  options: readonly { key: K; label: string }[];
  onChange: (key: K) => void;
  palette: Palette;
  align?: "left" | "right";
  searchThreshold?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      // Un frame después de que el menú ya esté en el DOM.
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  const current = options.find((o) => o.key === value);
  const searchable = options.length > searchThreshold;
  const filtered = searchable && query.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query.trim().toLowerCase())
      )
    : options;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-xs transition-colors"
        style={{ backgroundColor: palette.buttonBg, color: palette.buttonText }}
      >
        {current?.label ?? value}
        <span className="text-[9px] opacity-70">▾</span>
      </button>
      {open && (
        <div
          className={`absolute top-full z-40 mt-1 min-w-[140px] overflow-hidden rounded border shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
          style={{ backgroundColor: palette.buttonBg, borderColor: palette.wrapperBorder }}
        >
          {searchable && (
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="w-full border-b bg-transparent px-3 py-1.5 font-mono text-xs outline-none"
              style={{ borderColor: palette.wrapperBorder, color: palette.buttonText }}
            />
          )}
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 && (
              <p
                className="px-3 py-2 font-mono text-xs opacity-60"
                style={{ color: palette.buttonText }}
              >
                Sin resultados
              </p>
            )}
            {filtered.map((opt) => (
              <button
                key={opt.key}
                onClick={() => {
                  onChange(opt.key);
                  setOpen(false);
                }}
                className="block w-full whitespace-nowrap px-3 py-1.5 text-left font-mono text-xs transition-colors"
                style={{
                  backgroundColor: opt.key === value ? palette.buttonActiveBg : "transparent",
                  color: opt.key === value ? palette.buttonActiveText : palette.buttonText,
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Menú desplegable de indicadores: varias casillas que se pueden prender o
// apagar sin que el menú se cierre en cada clic.
function IndicatorsDropdown({
  showVolume,
  onToggleVolume,
  showBollinger,
  onToggleBollinger,
  invertScale,
  onToggleInvert,
  palette,
}: {
  showVolume: boolean;
  onToggleVolume: () => void;
  showBollinger: boolean;
  onToggleBollinger: () => void;
  invertScale: boolean;
  onToggleInvert: () => void;
  palette: Palette;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-xs transition-colors"
        style={{ backgroundColor: palette.buttonBg, color: palette.buttonText }}
      >
        Indicadores
        <span className="text-[9px] opacity-70">▾</span>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-40 mt-1 min-w-[170px] overflow-hidden rounded border shadow-lg"
          style={{ backgroundColor: palette.buttonBg, borderColor: palette.wrapperBorder }}
        >
          <label
            className="flex cursor-pointer items-center gap-2 px-3 py-2 font-mono text-xs"
            style={{ color: palette.buttonText }}
          >
            <input type="checkbox" checked={showVolume} onChange={onToggleVolume} />
            Volumen
          </label>
          <label
            className="flex cursor-pointer items-center gap-2 px-3 py-2 font-mono text-xs"
            style={{ color: palette.buttonText }}
          >
            <input type="checkbox" checked={showBollinger} onChange={onToggleBollinger} />
            Bandas de Bollinger
          </label>
          <label
            className="flex cursor-pointer items-center gap-2 px-3 py-2 font-mono text-xs"
            style={{ color: palette.buttonText }}
          >
            <input type="checkbox" checked={invertScale} onChange={onToggleInvert} />
            Invertir gráfico
          </label>
        </div>
      )}
    </div>
  );
}

export function CandleChart({
  // Para la Sala de Trading (gráfico a pantalla completa): en vez del alto
  // fijo de 420px, el panel ocupa toda la altura que le dé su contenedor.
  fillHeight = false,
}: { fillHeight?: boolean } = {}) {
  const [symbol, setSymbol] = useState<string>("SPY");
  // "Hora" por defecto: es el marco que la comunidad mira día a día — que
  // cada quien tenga que cambiarlo manualmente cada vez no tenía sentido.
  const [timeframe, setTimeframe] = useState<TimeframeKey>("1h");
  // Universo de símbolos que se puede elegir. Empieza con el gratuito nada
  // más (nunca se asume acceso) y se completa con el pagado (S&P 500 /
  // Nasdaq-100) si `/api/universe` confirma que hay suscripción activa.
  const [symbols, setSymbols] = useState<string[]>([...FREE_SYMBOLS]);
  const [theme, setTheme] = useState<Theme>("dark");
  const [showVolume, setShowVolume] = useState(true);
  const [showBollinger, setShowBollinger] = useState(false);
  const [invertScale, setInvertScale] = useState(false);
  const [data, setData] = useState<CandleSeries | null>(null);
  const [loading, setLoading] = useState(true);
  // Empieza en null a propósito: si se calculara con Date.now() aquí mismo,
  // el valor del render de servidor y el del primer render del navegador
  // no coincidirían (son instantes distintos) y React marcaría un error de
  // hidratación. Se llena el valor real recién montado el componente, en
  // el efecto de abajo — eso ya no es hidratación, es una actualización
  // normal posterior.
  const [nowSeconds, setNowSeconds] = useState<number | null>(null);
  // En qué altura (px) del panel cae el último precio — la insignia de
  // "próxima vela" se posiciona con esto para quedar pegada al precio.
  const [priceY, setPriceY] = useState<number | null>(null);
  // Último precio fuera de sesión — hacia dónde viene abriendo el mercado.
  const [extended, setExtended] = useState<ExtendedQuote | null>(null);
  // Próximo earning estimado del símbolo actual (ver src/lib/earnings.ts).
  const [earnings, setEarnings] = useState<EarningsInfo | null>(null);
  // Panel de favoritas (Sala de Trading): empieza oculto, un botón lo
  // despliega y lo vuelve a esconder — no siempre ocupando espacio.
  const [showWatchlist, setShowWatchlist] = useState(false);

  const palette = PALETTES[theme];

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const maSeriesRef = useRef<Record<string, ISeriesApi<"Line">>>({});
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<"Line"> | null>(null);
  // Copia siempre actualizada de `data`, para leerla desde callbacks creados
  // una sola vez (como el de resize) sin quedarse con datos viejos.
  const dataRef = useRef<CandleSeries | null>(null);
  // Alto real del panel ahora mismo — fijo (CHART_HEIGHT) normalmente, pero
  // dinámico en la Sala de Trading (`fillHeight`). `clampBadgeTop` lo usa
  // para no dejar salir la insignia del panel real, sea cual sea su alto.
  const chartHeightRef = useRef(CHART_HEIGHT);

  // Recalcula en qué altura cae el último precio en el panel — se llama
  // cuando llegan datos nuevos, al cambiar el tamaño del gráfico y al hacer
  // zoom o desplazarse por el histórico, para que la insignia se quede
  // pegada al precio como pidió Alejo.
  const updatePriceY = useCallback(() => {
    const candles = dataRef.current?.candles;
    const series = candleSeriesRef.current;
    if (!candles || candles.length === 0 || !series) return;
    const lastClose = candles[candles.length - 1].close;
    const y = series.priceToCoordinate(lastClose);
    setPriceY(y);
  }, []);

  // Qué símbolos puede elegir quien está mirando. El servidor decide (según
  // su sesión) si además del gratuito va también el universo pagado — el
  // navegador solo pinta lo que le llega, nunca decide acceso por su cuenta.
  useEffect(() => {
    let cancelled = false;
    fetch(fillHeight ? "/api/universe?scope=sala" : "/api/universe")
      .then((res) => res.json())
      .then((json: { free?: string[]; paid?: string[] }) => {
        if (cancelled) return;
        const all = [...(json.free ?? FREE_SYMBOLS), ...(json.paid ?? [])];
        setSymbols(Array.from(new Set(all)));
      })
      .catch(() => {
        // Se queda con el universo gratuito si falla la petición.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reloj de un segundo para el contador de "próxima vela en...". Arranca
  // ya montado en el navegador, nunca durante el render de servidor.
  useEffect(() => {
    function tick() {
      setNowSeconds(Math.floor(Date.now() / 1000));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

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
      timeScale: {
        borderColor: initialPalette.wrapperBorder,
        // Muestra la hora de cada vela (no solo la fecha) en marcos
        // intradía, igual que en ProRealTime.
        timeVisible: true,
        secondsVisible: false,
      },
      watermark: {
        visible: true,
        text: symbol,
        color: initialPalette.watermark,
        fontSize: 72,
        horzAlign: "center",
        vertAlign: "center",
      },
      height: fillHeight
        ? containerRef.current.clientHeight || CHART_HEIGHT
        : CHART_HEIGHT,
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
        const width = containerRef.current.clientWidth;
        if (fillHeight) {
          // El contenedor (flex-1 en la Sala de Trading) es quien decide el
          // alto real — el gráfico solo lo sigue.
          const height = containerRef.current.clientHeight || CHART_HEIGHT;
          chart.applyOptions({ width, height });
          chartHeightRef.current = height;
        } else {
          chart.applyOptions({ width });
        }
      }
      updatePriceY();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(containerRef.current);

    // Si el usuario hace zoom o se desplaza por el histórico también puede
    // cambiar la escala de precio (autoscale) — se recalcula ahí también
    // para que la insignia se mantenga pegada al precio.
    chart.timeScale().subscribeVisibleLogicalRangeChange(updatePriceY);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(updatePriceY);
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
    // Las bandas ensanchan (o angostan) el rango visible del eje de precio,
    // así que el último precio puede caer en otra altura al mostrarlas u
    // ocultarlas — un frame después de que aplique el nuevo autoscale.
    requestAnimationFrame(updatePriceY);
  }, [showBollinger, updatePriceY]);

  // Voltea la escala de precio, como el "Invert scale" de TradingView. Al
  // invertir, el último precio cae en otra altura del panel, así que se
  // recalcula la posición de la insignia un frame después.
  useEffect(() => {
    chartRef.current?.applyOptions({ rightPriceScale: { invertScale } });
    requestAnimationFrame(updatePriceY);
  }, [invertScale, updatePriceY]);

  // Descarta respuestas que lleguen tarde y fuera de orden — por ejemplo si
  // se cambia de símbolo mientras una petición anterior sigue en vuelo.
  const requestIdRef = useRef(0);

  // Pide las velas y las pinta. No toca el estado de "Cargando…": de eso se
  // encarga quien la llama, para que los refrescos de fondo no hagan
  // parpadear el gráfico. `fresh` le dice al servidor que salte su caché.
  const loadCandles = useCallback(
    async (fresh = false) => {
      const id = ++requestIdRef.current;
      const res = await fetch(
        `/api/candles?symbol=${symbol}&interval=${timeframe}` +
          `${fresh ? "&fresh=1" : ""}${fillHeight ? "&scope=sala" : ""}&t=${Date.now()}`
      );
      const json: CandleSeries = await res.json();
      if (id === requestIdRef.current) setData(json);
    },
    [symbol, timeframe]
  );

  // Carga inicial y cada vez que cambia el símbolo o el marco de tiempo. Esta
  // sí muestra "Cargando…", porque el gráfico se va a repintar entero.
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      try {
        await loadCandles();
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [loadCandles]);

  // Refresco de fondo mientras se mira el marco intradía, para que la vela en
  // curso se vea moverse en vez de quedarse congelada.
  //
  // Cada refresco cuesta 1 crédito de Twelve Data. A 60s el plan gratuito
  // (800 créditos/día) se agota en menos de 2 horas con una sola pestaña
  // abierta — pasó de verdad el 15 de sept. de 2026 (978/800 usados). Con
  // 5 minutos una pestaña sola gasta ~12 créditos/hora en vez de ~60, y
  // sigue viéndose "vivo" para efectos prácticos. Al subir a un plan pago de
  // Twelve Data (que además quita el límite diario) esto se puede volver a
  // bajar sin miedo.
  useEffect(() => {
    if (timeframe !== "1h") return;
    const id = setInterval(() => {
      loadCandles().catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [timeframe, loadCandles]);

  // Justo al cruzar el cambio de hora se pide la vela nueva saltando el caché,
  // para que aparezca al instante igual que en ProRealTime. Se reintenta un
  // par de veces porque el proveedor tarda unos segundos en publicarla.
  useEffect(() => {
    if (timeframe !== "1h") return;

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    function scheduleNextBoundary() {
      const now = Math.floor(Date.now() / 1000);
      const boundary = nextCandleBoundary(now, "1h");
      // +2 s de margen: pedirla en el segundo exacto suele llegar antes de que
      // el proveedor haya cerrado la vela anterior.
      const delay = Math.max((boundary - now) * 1000 + 2000, 1000);

      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          loadCandles(true).catch(() => {});
          timers.push(
            setTimeout(() => {
              if (!cancelled) loadCandles(true).catch(() => {});
            }, 10 * 1000)
          );
          timers.push(
            setTimeout(() => {
              if (!cancelled) loadCandles(true).catch(() => {});
            }, 30 * 1000)
          );
          scheduleNextBoundary();
        }, delay)
      );
    }

    scheduleNextBoundary();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [timeframe, loadCandles]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Pre-mercado / after-hours. Se refresca UNA VEZ POR HORA a propósito: el
  // dato no necesita ir al segundo y así casi no consume créditos de la API.
  // El servidor además solo llama a Twelve Data fuera de la sesión regular.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(
          `/api/premarket?symbol=${symbol}${fillHeight ? "&scope=sala" : ""}`
        );
        const json: ExtendedQuote = await res.json();
        if (!cancelled) setExtended(json);
      } catch {
        if (!cancelled) setExtended(null);
      }
    }

    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol]);

  // Próximo earning estimado (ver src/lib/earnings.ts). La fecha no cambia
  // durante el día, así que basta con pedirla al cambiar de símbolo — el
  // servidor además la cachea 24h, así que ni eso gasta créditos de más.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(
          `/api/earnings?symbol=${symbol}${fillHeight ? "&scope=sala" : ""}`
        );
        const json: EarningsInfo = await res.json();
        if (!cancelled) setEarnings(json);
      } catch {
        if (!cancelled) setEarnings(null);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  // Los formateadores del eje se vuelven a aplicar cada vez que cambia el
  // marco de tiempo. Es importante que sean funciones nuevas: lightweight-
  // charts guarda en caché las etiquetas ya calculadas, y si se le deja la
  // misma función se queda con etiquetas del marco anterior (se veía, por
  // ejemplo, una vela rotulada 16:00 —la hora UTC— entre las demás en hora
  // local). Debe declararse antes del efecto que pinta los datos, para que
  // el redibujado ya use el formato correcto.
  useEffect(() => {
    const intraday = timeframe === "1h";
    chartRef.current?.applyOptions({
      timeScale: {
        tickMarkFormatter: (time: Time, tickMarkType: TickMarkType) =>
          formatTickMark(time as number, tickMarkType, intraday),
      },
      localization: {
        timeFormatter: (time: Time) =>
          formatCrosshairTime(time as number, intraday),
      },
    });
  }, [timeframe]);

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

    // Señala SOLO la vela de apertura de la sesión más reciente — la de media
    // hora con la que arranca el día (8:30 en Colombia). Antes se marcaban
    // todas las aperturas del histórico y el gráfico quedaba lleno de puntos;
    // el que de verdad hace falta es el del día en curso, para saber de un
    // vistazo que el mercado ya abrió y si abrió verde o rojo.
    //
    // El tamaño del marcador tiene un mínimo en lightweight-charts, así que
    // por debajo de 0.3 no se ve más pequeño: por eso se reduce el número de
    // marcadores en vez de achicarlos más.
    if (timeframe === "1h" && data.candles.length > 0) {
      const ultima = data.candles[data.candles.length - 1];
      const diaActual = Math.floor(ultima.time / 86400);

      // Primera vela de ese día: la apertura.
      const candlesDelDia = data.candles.filter(
        (c) => Math.floor(c.time / 86400) === diaActual
      );
      const apertura = candlesDelDia[0] ?? ultima;

      candleSeriesRef.current.setMarkers([
        {
          time: apertura.time as unknown as UTCTimestamp,
          // Al invertir el gráfico las velas se voltean, así que el marcador
          // se pasa arriba para que no le quede encima.
          position: invertScale ? "aboveBar" : "belowBar",
          color: apertura.close >= apertura.open ? "#089981" : "#F23645",
          shape: "circle",
          size: 0.3,
          // El texto solo en el gráfico normal: al invertirlo queda debajo de
          // las velas volteadas y no se lee.
          text: invertScale ? undefined : "apertura",
        },
      ]);

      // El marco "Hora" siempre arranca centrado en la sesión más reciente
      // (el día en curso, o el último día hábil si el mercado está cerrado)
      // en vez de mostrar los 180 días de historia que se piden de fondo
      // para las medias móviles — a nadie le sirve ver seis meses de velas
      // horarias amontonadas.
      chartRef.current?.timeScale().setVisibleRange({
        from: apertura.time as unknown as UTCTimestamp,
        to: (ultima.time + 3600) as unknown as UTCTimestamp,
      });
    } else {
      candleSeriesRef.current.setMarkers([]);
      chartRef.current?.timeScale().fitContent();
    }

    // Un frame después, para que el autoscale del precio ya haya aplicado
    // antes de calcular dónde cae el último precio en el panel.
    requestAnimationFrame(updatePriceY);
  }, [data, timeframe, invertScale, updatePriceY]);

  const secondsToNextCandle =
    nowSeconds === null ? null : nextCandleBoundary(nowSeconds, timeframe) - nowSeconds;

  // Días que faltan para el earning estimado (negativo si ya pasó). `null`
  // si no hay estimación (ETFs como SPY/GLD, o todavía sin cargar).
  const earningsDaysAway =
    !earnings?.nextEstimatedDate || nowSeconds === null
      ? null
      : Math.ceil(
          (new Date(`${earnings.nextEstimatedDate}T00:00:00Z`).getTime() / 1000 -
            nowSeconds) /
            86400
        );

  // El panel del gráfico en sí — igual en ambos modos. Solo se envuelve en
  // un contenedor aparte (con la lista de seguimiento al lado) cuando
  // `fillHeight` está activo, ver el `return` más abajo.
  const chartPanel = (
    <div
      className={
        fillHeight
          ? "flex h-full min-w-0 flex-1 flex-col rounded-lg border p-4 transition-colors"
          : "rounded-lg border p-4 transition-colors"
      }
      style={{
        backgroundColor: palette.wrapperBg,
        borderColor: palette.wrapperBorder,
      }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SelectDropdown
            value={symbol}
            options={symbols.map((s) => ({ key: s, label: s }))}
            onChange={setSymbol}
            palette={palette}
          />
          <SelectDropdown
            value={timeframe}
            options={TIMEFRAMES}
            onChange={setTimeframe}
            palette={palette}
          />
        </div>

        <div className="flex items-center gap-2">
          <IndicatorsDropdown
            showVolume={showVolume}
            onToggleVolume={() => setShowVolume((v) => !v)}
            showBollinger={showBollinger}
            onToggleBollinger={() => setShowBollinger((v) => !v)}
            invertScale={invertScale}
            onToggleInvert={() => setInvertScale((v) => !v)}
            palette={palette}
          />
          {fillHeight && (
            <button
              onClick={() => setShowWatchlist((v) => !v)}
              className="rounded px-2.5 py-1.5 font-mono text-xs transition-colors"
              style={{
                backgroundColor: showWatchlist ? palette.buttonActiveBg : palette.buttonBg,
                color: showWatchlist ? palette.buttonActiveText : palette.buttonText,
              }}
              title="Mostrar u ocultar tus favoritas"
              aria-label="Mostrar u ocultar tus favoritas"
              aria-pressed={showWatchlist}
            >
              ★ Favoritas
            </button>
          )}
          <button
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            className="rounded px-2.5 py-1.5 text-sm transition-colors"
            style={{ backgroundColor: palette.buttonBg, color: palette.buttonText }}
            title="Cambiar fondo del gráfico"
            aria-label="Cambiar fondo del gráfico"
          >
            {theme === "dark" ? "☀" : "☾"}
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

        {/* Hacia dónde viene abriendo el mercado. Solo aparece fuera de la
            sesión regular y cuando el plan de datos entrega precio extendido. */}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Aviso de earning próximo — a propósito NO es un ícono sobre la
              vela (como el de TradingView): es una nota aparte, para que
              quede claro que es una fecha ESTIMADA nuestra (calculada del
              patrón de reportes pasados), no un dato confirmado por la
              empresa. Ver src/lib/earnings.ts. Solo aparece si falta poco
              (EARNINGS_WARNING_DAYS) y todavía no pasó. */}
          {earningsDaysAway !== null &&
            earningsDaysAway >= 0 &&
            earningsDaysAway <= EARNINGS_WARNING_DAYS && (
            <span
              className="flex items-center gap-2 rounded px-2 py-0.5"
              style={{ backgroundColor: palette.badgeBg }}
              title={`Fecha estimada a partir del patrón de reportes anteriores: ${earnings?.nextEstimatedDate}`}
            >
              <span className="opacity-70">EARNINGS</span>
              <span>
                {earningsDaysAway === 0
                  ? "hoy"
                  : `en ${earningsDaysAway} día${earningsDaysAway === 1 ? "" : "s"}`}
              </span>
              <span className="opacity-50">(estimado)</span>
            </span>
          )}

          {/* Hacia dónde viene abriendo el mercado. Solo aparece fuera de la
              sesión regular y cuando el plan de datos entrega precio
              extendido. `typeof === "number"` a propósito, no `!== null`:
              si la petición falló (símbolo no disponible, error de red,
              etc.) `extended` trae un `price` en `undefined`, no `null` —
              con `!== null` esa comparación pasaba igual y
              `undefined.toFixed()` tumbaba toda la página. Pasó de verdad
              con símbolos del universo pagado antes de que /api/premarket
              los reconociera (ver ARQUITECTURA.md). */}
          {extended &&
            typeof extended.price === "number" &&
            extended.session !== "regular" && (
            <span
              className="flex items-center gap-2 rounded px-2 py-0.5"
              style={{ backgroundColor: palette.badgeBg }}
              title={
                extended.timestamp
                  ? `Último precio fuera de sesión: ${formatCrosshairTime(extended.timestamp, true)}`
                  : undefined
              }
            >
              <span className="opacity-70">
                {SESSION_LABEL[extended.session] ?? "FUERA DE SESIÓN"}
              </span>
              <span>{extended.price.toFixed(2)}</span>
              {typeof extended.percentChange === "number" && (
                <span
                  style={{
                    color: extended.percentChange >= 0 ? "#089981" : "#F23645",
                  }}
                >
                  {extended.percentChange >= 0 ? "+" : ""}
                  {extended.percentChange.toFixed(2)}%
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      <div className={fillHeight ? "relative min-h-0 flex-1" : "relative"}>
        <div ref={containerRef} className={fillHeight ? "h-full w-full" : "w-full"} />
        {/* Cuenta regresiva hasta que cierre la vela actual y abra la
            siguiente — pegada justo debajo de la etiqueta de precio actual,
            así que sube y baja con el precio en vez de quedar fija en una
            esquina. */}
        <div
          className="pointer-events-none absolute right-2 z-30 rounded px-2 py-1 font-mono text-[10px] transition-[top] duration-200 ease-out"
          style={{
            backgroundColor: palette.badgeBg,
            color: palette.textSoft,
            top: `${clampBadgeTop(priceY, chartHeightRef.current)}px`,
          }}
        >
          Próxima vela en{" "}
          {secondsToNextCandle === null ? "—:—" : formatCountdown(secondsToNextCandle)}
        </div>
      </div>

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

  if (!fillHeight) return chartPanel;

  // Sala de Trading: el botón "★ Favoritas" del toolbar despliega y
  // esconde el panel — no ocupa espacio hasta que alguien lo pide.
  if (!showWatchlist) return chartPanel;

  return (
    <div className="flex h-full gap-3">
      {chartPanel}
      <Watchlist symbol={symbol} onSelect={setSymbol} palette={palette} />
    </div>
  );
}

