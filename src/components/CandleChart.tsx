"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  LineStyle,
  TickMarkType,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesPrimitive,
  type ISeriesPrimitivePaneRenderer,
  type ISeriesPrimitivePaneView,
  type Logical,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type { CandleSeries, ExtendedQuote } from "@/lib/marketData";
import type { EarningsInfo } from "@/lib/earnings";
import { FREE_SYMBOLS } from "@/lib/universe";
import { Watchlist } from "./Watchlist";

// A cuántos días o menos de un earning estimado aparece el aviso — no tiene
// caso mostrarlo con meses de anticipación, ver docs/ARQUITECTURA.md.
const EARNINGS_WARNING_DAYS = 21;

// `label` es el nombre largo (para el árbol de objetos / accesibilidad);
// `short` es lo que se pinta en el botón de la barra, tipo TradingView
// (5m 15m 30m 1h D S M).
const TIMEFRAMES = [
  { key: "5min", label: "5m", short: "5m" },
  { key: "15min", label: "15m", short: "15m" },
  { key: "30min", label: "30m", short: "30m" },
  { key: "1h", label: "Hora", short: "1h" },
  { key: "1day", label: "Día", short: "D" },
  { key: "1week", label: "Semana", short: "S" },
  { key: "1month", label: "Mes", short: "M" },
] as const;

type TimeframeKey = (typeof TIMEFRAMES)[number]["key"];

// Marcos que muestran velas dentro del mismo día de mercado — comparten toda
// la lógica de "intradía": hora en vez de solo fecha, marcador de apertura,
// zoom centrado en los últimos días en vez de en todo el historial cargado,
// y refresco periódico mientras el mercado está abierto.
const INTRADAY_TIMEFRAMES = new Set<TimeframeKey>([
  "5min",
  "15min",
  "30min",
  "1h",
]);

// Minutos de cada marco de minutos, para calcular la cuenta regresiva hasta
// la próxima vela (ver nextCandleBoundary). Se redondea contra la medianoche
// UTC en vez de contra la apertura del mercado (9:30 en Nueva York) — a
// veces se corre hasta media hora de más, pero es una insignia informativa,
// no algo de lo que dependa ningún cálculo.
const INTRADAY_MINUTES: Partial<Record<TimeframeKey, number>> = {
  "5min": 5,
  "15min": 15,
  "30min": 30,
};

const MA_LINES = [
  { key: "sma20" as const, label: "PM 20", color: "#EAB308" },
  { key: "sma40" as const, label: "PM 40", color: "#F23645" },
  { key: "sma100" as const, label: "PM 100", color: "#089981" },
  { key: "sma200" as const, label: "PM 200", color: "#A855F7" },
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

// ---------------------------------------------------------------------------
// Dibujos sobre el gráfico (tendencia, regla de medición)
//
// `lightweight-charts` no trae herramientas de dibujo de fábrica — solo deja
// "adjuntarle" objetos propios a una serie (API de "primitives") que se
// encargan de dibujarse a mano sobre el canvas en cada repintado. Estas dos
// clases son justo eso: cada una sabe convertir sus puntos (tiempo, precio) a
// coordenadas de pantalla y trazarse con el context 2D normal — el resto
// (cuándo crearlas, dónde guardarlas, cómo se borran) vive en CandleChart de
// abajo.
// ---------------------------------------------------------------------------

// Un punto de dibujo se guarda como posición LÓGICA (índice de barra, puede
// tener decimales y ser negativo o mayor que la última vela) en vez de un
// tiempo absoluto. Es lo que de verdad permite que un dibujo se pueda
// colocar en cualquier parte del gráfico, incluyendo el espacio en blanco
// después de la última vela (donde no hay ninguna vela real todavía): con
// tiempo absoluto, `timeToCoordinate`/`coordinateToTime` devuelven `null`
// fuera del rango de datos cargado — con posición lógica, `lightweight-
// charts` sabe convertir de sobra hacia ambos lados sin necesitar una vela
// real en esa posición.
type DrawPoint = { logical: number; price: number };
type DrawTool = "none" | "horizontal" | "trend" | "measure" | "regression" | "text";

// Cuadro de texto libre — a diferencia de los demás dibujos, no vive como
// ISeriesPrimitive (canvas), sino como un <div> de verdad superpuesto al
// gráfico: hace falta contenido editable de verdad (escribir, seleccionar,
// pegar), y eso no se puede hacer sobre un canvas. Solo la esquina superior
// izquierda (`logical`/`price`) sigue al gráfico al desplazarse o hacer
// zoom; el tamaño es un rectángulo fijo en píxeles, independiente del zoom.
type TextBoxState = {
  id: string;
  logical: number;
  price: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  align: "left" | "center";
};

const TEXT_BOX_MIN_FONT = 9;
const TEXT_BOX_MAX_FONT = 28;

// Qué tan cerca (en píxeles) hay que soltar el clic de un extremo ya
// trazado para "agarrarlo" y moverlo, en vez de dibujar uno nuevo.
const HANDLE_HIT_RADIUS = 10;

function logicalToX(chart: IChartApi, logical: number): number | null {
  return chart.timeScale().logicalToCoordinate(logical as Logical);
}

// Línea diagonal entre dos puntos — como la "Tendencia" de TradingView.
// Libre de verdad: el usuario la traza con clic-arrastrar-soltar, viendo la
// línea seguir el cursor en vivo, y después puede volver a agarrar
// cualquiera de sus dos extremos (los círculos en las puntas, siempre
// visibles) y moverlo — ver `setPoints`/`requestUpdate`, sin esto mover
// `p2` no repintaría nada, porque `draw()` leería para siempre los valores
// que tenía el objeto en el instante en que lightweight-charts llamó por
// primera vez a `paneViews()`, no los que tiene ahora.
class TrendLinePrimitive implements ISeriesPrimitive<Time> {
  private requestUpdate: (() => void) | null = null;

  constructor(
    private chart: IChartApi,
    private series: ISeriesApi<"Candlestick">,
    public p1: DrawPoint,
    public p2: DrawPoint,
    private color: string = "#F5A623"
  ) {}

  attached(param: { requestUpdate: () => void }): void {
    this.requestUpdate = param.requestUpdate;
  }

  setPoints(p1: DrawPoint, p2: DrawPoint): void {
    this.p1 = p1;
    this.p2 = p2;
    this.requestUpdate?.();
  }

  // `null` si el clic no cayó cerca de ningún extremo — si no, cuál de los
  // dos ("p1" o "p2") para que quien llama sepa cuál mover.
  hitTestHandle(x: number, y: number): "p1" | "p2" | null {
    const { chart, series, p1, p2 } = this;
    for (const [key, p] of [["p1", p1], ["p2", p2]] as const) {
      const px = logicalToX(chart, p.logical);
      const py = series.priceToCoordinate(p.price);
      if (px === null || py === null) continue;
      if (Math.hypot(px - x, py - y) <= HANDLE_HIT_RADIUS) return key;
    }
    return null;
  }

  paneViews(): ISeriesPrimitivePaneView[] {
    const primitive = this;
    return [
      {
        renderer(): ISeriesPrimitivePaneRenderer {
          return {
            draw(target: CanvasRenderingTarget2D) {
              const { chart, series, p1, p2, color } = primitive;
              const x1 = logicalToX(chart, p1.logical);
              const y1 = series.priceToCoordinate(p1.price);
              const x2 = logicalToX(chart, p2.logical);
              const y2 = series.priceToCoordinate(p2.price);
              if (x1 === null || y1 === null || x2 === null || y2 === null) return;
              target.useMediaCoordinateSpace(({ context }) => {
                context.save();
                context.strokeStyle = color;
                context.lineWidth = 2;
                context.beginPath();
                context.moveTo(x1, y1);
                context.lineTo(x2, y2);
                context.stroke();
                {
                  context.fillStyle = color;
                  for (const [px, py] of [[x1, y1], [x2, y2]] as const) {
                    context.beginPath();
                    context.arc(px, py, 5, 0, Math.PI * 2);
                    context.fill();
                  }
                }
                context.restore();
              });
            },
          };
        },
      },
    ];
  }
}

// Regla de medición — un rectángulo semitransparente entre dos puntos, con
// una etiqueta mostrando la diferencia de precio, el % y cuántas velas hay
// de por medio. Igual que la "regla" de TradingView: se traza libre y
// después se puede seguir agarrando de cualquiera de sus dos esquinas para
// ajustarla, sin tener que borrarla y volver a empezar.
class MeasurePrimitive implements ISeriesPrimitive<Time> {
  private requestUpdate: (() => void) | null = null;

  constructor(
    private chart: IChartApi,
    private series: ISeriesApi<"Candlestick">,
    public p1: DrawPoint,
    public p2: DrawPoint,
    public barsBetween: number
  ) {}

  attached(param: { requestUpdate: () => void }): void {
    this.requestUpdate = param.requestUpdate;
  }

  setPoints(p1: DrawPoint, p2: DrawPoint, barsBetween: number): void {
    this.p1 = p1;
    this.p2 = p2;
    this.barsBetween = barsBetween;
    this.requestUpdate?.();
  }

  hitTestHandle(x: number, y: number): "p1" | "p2" | null {
    const { chart, series, p1, p2 } = this;
    for (const [key, p] of [["p1", p1], ["p2", p2]] as const) {
      const px = logicalToX(chart, p.logical);
      const py = series.priceToCoordinate(p.price);
      if (px === null || py === null) continue;
      if (Math.hypot(px - x, py - y) <= HANDLE_HIT_RADIUS) return key;
    }
    return null;
  }

  paneViews(): ISeriesPrimitivePaneView[] {
    const primitive = this;
    return [
      {
        renderer(): ISeriesPrimitivePaneRenderer {
          return {
            draw(target: CanvasRenderingTarget2D) {
              const { chart, series, p1, p2, barsBetween } = primitive;
              const subiendo = p2.price >= p1.price;
              // Mismo verde/rojo de siempre pero un poco más oscuros (80% de
              // brillo) — a pedido de Alejo, para que la flecha central y el
              // recuadro no compitan tanto en intensidad con las velas.
              const solido = subiendo ? "#067A67" : "#C22B37";
              const color = subiendo ? "rgba(6,122,103,0.55)" : "rgba(194,43,55,0.55)";
              const fondo = subiendo ? "rgba(6,122,103,0.15)" : "rgba(194,43,55,0.15)";

              const x1 = logicalToX(chart, p1.logical);
              const y1 = series.priceToCoordinate(p1.price);
              const x2 = logicalToX(chart, p2.logical);
              const y2 = series.priceToCoordinate(p2.price);
              if (x1 === null || y1 === null || x2 === null || y2 === null) return;

              const diff = p2.price - p1.price;
              const pct = p1.price !== 0 ? (diff / p1.price) * 100 : 0;
              const etiqueta =
                `${diff >= 0 ? "+" : ""}${diff.toFixed(2)} ` +
                `(${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%)  ${barsBetween} barras`;

              target.useMediaCoordinateSpace(({ context }) => {
                context.save();
                const left = Math.min(x1, x2);
                const right = Math.max(x1, x2);
                const top = Math.min(y1, y2);
                const bottom = Math.max(y1, y2);

                context.fillStyle = fondo;
                context.fillRect(left, top, right - left, bottom - top);
                context.strokeStyle = color;
                context.lineWidth = 1;
                context.strokeRect(left, top, right - left, bottom - top);

                context.fillStyle = color;
                for (const [px, py] of [[x1, y1], [x2, y2]] as const) {
                  context.beginPath();
                  context.arc(px, py, 5, 0, Math.PI * 2);
                  context.fill();
                }

                // Flechita en el centro del recuadro, apuntando hacia donde
                // se movió el precio — un vistazo rápido de sube/baja sin
                // tener que leer la etiqueta, como en TradingView. Se salta
                // si el recuadro es demasiado chico para que quepa sin
                // desbordarse.
                const midX = (left + right) / 2;
                const midY = (top + bottom) / 2;
                const arrow = 8;
                if (right - left > arrow * 2 + 6 && bottom - top > arrow * 2 + 6) {
                  context.fillStyle = solido;
                  context.beginPath();
                  if (subiendo) {
                    context.moveTo(midX, midY - arrow);
                    context.lineTo(midX - arrow, midY + arrow);
                    context.lineTo(midX + arrow, midY + arrow);
                  } else {
                    context.moveTo(midX, midY + arrow);
                    context.lineTo(midX - arrow, midY - arrow);
                    context.lineTo(midX + arrow, midY - arrow);
                  }
                  context.closePath();
                  context.fill();
                }

                context.font = "11px 'IBM Plex Mono', ui-monospace, monospace";
                const textWidth = context.measureText(etiqueta).width;
                const labelX = Math.min(Math.max(left, 4), right - textWidth - 8);
                const labelY = top > 16 ? top - 6 : bottom + 16;
                context.fillStyle = solido;
                context.fillText(etiqueta, labelX + 4, labelY);
                context.restore();
              });
            },
          };
        },
      },
    ];
  }
}

// Canal de regresión — línea de tendencia estadística (mínimos cuadrados
// sobre el cierre de las velas del rango elegido) más dos bandas a ±2
// desviaciones estándar de los residuos, como el "Regression Trend" de
// TradingView. A diferencia de Tendencia/Regla, vuelve a calcular todo en
// cada repintado a partir de las velas cargadas (`getCandles`) en vez de
// puntos fijos — si llegan velas nuevas dentro del rango, el canal se ajusta
// solo.
class RegressionChannelPrimitive implements ISeriesPrimitive<Time> {
  private requestUpdate: (() => void) | null = null;

  constructor(
    private chart: IChartApi,
    private series: ISeriesApi<"Candlestick">,
    // Rango en posición lógica (índice de barra), no en tiempo — igual que
    // los puntos de Tendencia/Regla, para poder elegir el rango libremente
    // incluso más allá de la última vela cargada. Al calcular la regresión
    // se recorta a las velas reales que sí existen (`Math.round` + clamp).
    private fromLogical: number,
    private toLogical: number,
    private getCandles: () => CandleSeries["candles"] | undefined
  ) {}

  attached(param: { requestUpdate: () => void }): void {
    this.requestUpdate = param.requestUpdate;
  }

  setRange(fromLogical: number, toLogical: number): void {
    this.fromLogical = fromLogical;
    this.toLogical = toLogical;
    this.requestUpdate?.();
  }

  paneViews(): ISeriesPrimitivePaneView[] {
    const primitive = this;
    return [
      {
        renderer(): ISeriesPrimitivePaneRenderer {
          return {
            draw(target: CanvasRenderingTarget2D) {
              const { chart, series, fromLogical, toLogical, getCandles } = primitive;
              const all = getCandles() ?? [];
              const i1 = Math.max(0, Math.round(Math.min(fromLogical, toLogical)));
              const i2 = Math.min(all.length - 1, Math.round(Math.max(fromLogical, toLogical)));
              const candles = i2 >= i1 ? all.slice(i1, i2 + 1) : [];
              const n = candles.length;
              if (n < 2) return;

              let sumX = 0;
              let sumY = 0;
              let sumXY = 0;
              let sumXX = 0;
              candles.forEach((c, i) => {
                sumX += i;
                sumY += c.close;
                sumXY += i * c.close;
                sumXX += i * i;
              });
              const denom = n * sumXX - sumX * sumX;
              if (denom === 0) return;
              const m = (n * sumXY - sumX * sumY) / denom;
              const b = (sumY - m * sumX) / n;

              let sqResid = 0;
              candles.forEach((c, i) => {
                const pred = m * i + b;
                sqResid += (c.close - pred) ** 2;
              });
              const width = Math.sqrt(sqResid / n) * 2;

              const midStart = b;
              const midEnd = m * (n - 1) + b;

              const x1 = logicalToX(chart, i1);
              const x2 = logicalToX(chart, i2);
              const yMid1 = series.priceToCoordinate(midStart);
              const yMid2 = series.priceToCoordinate(midEnd);
              const yUp1 = series.priceToCoordinate(midStart + width);
              const yUp2 = series.priceToCoordinate(midEnd + width);
              const yLo1 = series.priceToCoordinate(midStart - width);
              const yLo2 = series.priceToCoordinate(midEnd - width);
              if (
                x1 === null || x2 === null || yMid1 === null || yMid2 === null ||
                yUp1 === null || yUp2 === null || yLo1 === null || yLo2 === null
              ) {
                return;
              }

              target.useMediaCoordinateSpace(({ context }) => {
                context.save();

                context.beginPath();
                context.moveTo(x1, yUp1);
                context.lineTo(x2, yUp2);
                context.lineTo(x2, yLo2);
                context.lineTo(x1, yLo1);
                context.closePath();
                context.fillStyle = "rgba(168,85,247,0.12)";
                context.fill();

                context.strokeStyle = "#A855F7";
                context.lineWidth = 2;
                context.beginPath();
                context.moveTo(x1, yMid1);
                context.lineTo(x2, yMid2);
                context.stroke();

                context.setLineDash([4, 3]);
                context.lineWidth = 1;
                context.beginPath();
                context.moveTo(x1, yUp1);
                context.lineTo(x2, yUp2);
                context.stroke();
                context.beginPath();
                context.moveTo(x1, yLo1);
                context.lineTo(x2, yLo2);
                context.stroke();
                context.setLineDash([]);

                context.restore();
              });
            },
          };
        },
      },
    ];
  }
}

// Fondos alternados por día — puramente decorativo (lo que se veía en el
// video de TradingView), para separar visualmente un día de mercado del
// siguiente en los marcos intradía. Solo colorea los días "pares" (según su
// número de día desde 1970) con un tinte dorado casi imperceptible; los
// impares se dejan sin nada, así se ve la alternancia sin oscurecer el
// gráfico. Se dibuja con `drawBackground` — la capa de fondo, siempre detrás
// de las velas — así que no tapa nada.
class DayBandsPrimitive implements ISeriesPrimitive<Time> {
  constructor(
    private chart: IChartApi,
    private getCandles: () => CandleSeries["candles"] | undefined,
    private isIntraday: () => boolean
  ) {}

  paneViews(): ISeriesPrimitivePaneView[] {
    const { chart, getCandles, isIntraday } = this;
    return [
      {
        renderer(): ISeriesPrimitivePaneRenderer {
          return {
            draw() {
              // Nada en la capa normal — todo el trabajo va en el fondo.
            },
            drawBackground(target: CanvasRenderingTarget2D) {
              if (!isIntraday()) return;
              const candles = getCandles();
              if (!candles || candles.length === 0) return;
              const timeScale = chart.timeScale();

              target.useMediaCoordinateSpace(({ context, mediaSize }) => {
                let runStart = 0;
                for (let i = 1; i <= candles.length; i++) {
                  const cambioDeDia =
                    i === candles.length ||
                    Math.floor(candles[i].time / 86400) !==
                      Math.floor(candles[runStart].time / 86400);
                  if (!cambioDeDia) continue;

                  const diaIndex = Math.floor(candles[runStart].time / 86400);
                  if (diaIndex % 2 === 0) {
                    const xStart = timeScale.timeToCoordinate(
                      candles[runStart].time as unknown as Time
                    );
                    const xEnd =
                      i < candles.length
                        ? timeScale.timeToCoordinate(candles[i].time as unknown as Time)
                        : mediaSize.width;
                    if (xStart !== null && xEnd !== null) {
                      context.fillStyle = "rgba(212,175,55,0.05)";
                      context.fillRect(xStart, 0, xEnd - xStart, mediaSize.height);
                    }
                  }
                  runStart = i;
                }
              });
            },
          };
        },
      },
    ];
  }
}

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
  const minutes = INTRADAY_MINUTES[timeframe];
  if (minutes) {
    const stepSeconds = minutes * 60;
    return (Math.floor(nowSeconds / stepSeconds) + 1) * stepSeconds;
  }
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

// Fila de botones de temporalidad, tipo TradingView (5m 15m 30m 1h D S M):
// todas visibles a la vez, la activa resaltada. A pedido de Alejo, en vez
// del menú desplegable "Hora" — así se cambia de marco con un solo clic.
function TimeframeButtons({
  value,
  onChange,
  palette,
}: {
  value: TimeframeKey;
  onChange: (key: TimeframeKey) => void;
  palette: Palette;
}) {
  return (
    <div
      className="flex items-center gap-0.5 rounded p-0.5"
      style={{ backgroundColor: palette.buttonBg }}
    >
      {TIMEFRAMES.map((tf) => {
        const active = tf.key === value;
        return (
          <button
            key={tf.key}
            onClick={() => onChange(tf.key)}
            aria-pressed={active}
            aria-label={tf.label}
            className="rounded px-2.5 py-1 font-mono text-xs font-medium transition-colors"
            style={{
              backgroundColor: active ? palette.buttonActiveBg : "transparent",
              color: active ? palette.buttonActiveText : palette.buttonText,
            }}
          >
            {tf.short}
          </button>
        );
      })}
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
  showDayBands,
  onToggleDayBands,
  invertScale,
  onToggleInvert,
  palette,
}: {
  showVolume: boolean;
  onToggleVolume: () => void;
  showBollinger: boolean;
  onToggleBollinger: () => void;
  showDayBands: boolean;
  onToggleDayBands: () => void;
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
            title="Solo en marcos intradía (5m a Hora) — separa un día de mercado del siguiente con un tinte apenas visible."
          >
            <input type="checkbox" checked={showDayBands} onChange={onToggleDayBands} />
            Fondos por día
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

// "Árbol de objetos", como en TradingView: qué hay activo en el gráfico
// ahora mismo, en un solo lugar — las 4 PM siempre están (no se pueden
// apagar todavía), Bollinger/Volumen reflejan el estado del menú
// "Indicadores", y cada línea horizontal dibujada aparece con su precio y
// un botón para borrarla.
// Menú de herramientas de dibujo — una sola activa a la vez (elegir otra, o
// la misma de nuevo, apaga la anterior). El botón se queda resaltado
// mientras la herramienta sigue activa, esperando el clic (Horizontal) o el
// arrastre (Tendencia/Regla/Regresión) que la va a dibujar.
const DRAW_TOOLS = [
  { key: "horizontal" as const, label: "Horizontal", hint: "Un clic marca el precio" },
  { key: "trend" as const, label: "Tendencia", hint: "Clic, arrastra y suelta" },
  { key: "measure" as const, label: "Regla", hint: "Clic, arrastra y suelta" },
  { key: "regression" as const, label: "Regresión", hint: "Clic, arrastra y suelta" },
  { key: "text" as const, label: "Texto", hint: "Un clic coloca el cuadro" },
];

// Icono de cada herramienta de dibujo, para la barra vertical de la
// izquierda (18x18, traza con currentColor así hereda el color del botón).
function DrawToolIcon({ tool }: { tool: Exclude<DrawTool, "none"> }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 18 18",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (tool) {
    case "horizontal":
      return (
        <svg {...common}>
          <line x1="2" y1="9" x2="16" y2="9" />
          <circle cx="4" cy="9" r="1.3" fill="currentColor" stroke="none" />
          <circle cx="14" cy="9" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      );
    case "trend":
      return (
        <svg {...common}>
          <line x1="3" y1="15" x2="15" y2="3" />
          <circle cx="3" cy="15" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="15" cy="3" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      );
    case "measure":
      return (
        <svg {...common}>
          <rect x="2.5" y="6" width="13" height="6" rx="1" />
          <line x1="6" y1="6" x2="6" y2="9" />
          <line x1="9" y1="6" x2="9" y2="9" />
          <line x1="12" y1="6" x2="12" y2="9" />
        </svg>
      );
    case "regression":
      return (
        <svg {...common}>
          <line x1="3" y1="13" x2="15" y2="5" />
          <line x1="3" y1="16" x2="15" y2="8" strokeDasharray="2 2" opacity="0.7" />
          <line x1="3" y1="10" x2="15" y2="2" strokeDasharray="2 2" opacity="0.7" />
        </svg>
      );
    case "text":
      return (
        <svg {...common}>
          <line x1="4" y1="4" x2="14" y2="4" />
          <line x1="9" y1="4" x2="9" y2="14" />
        </svg>
      );
  }
}

// Barra vertical de herramientas de dibujo, pegada al borde izquierdo del
// gráfico y siempre visible — como la de TradingView (a pedido de Alejo,
// viendo su gráfico real). Cada icono es una herramienta; al hacer clic se
// activa (queda resaltada) y el próximo clic/arrastre sobre el gráfico
// dibuja. Volver a hacer clic en la misma la apaga. Reemplaza al antiguo
// menú desplegable "Dibujar".
function DrawToolbar({
  drawTool,
  onSelect,
  palette,
}: {
  drawTool: DrawTool;
  onSelect: (tool: Exclude<DrawTool, "none">) => void;
  palette: Palette;
}) {
  return (
    <div
      className="flex shrink-0 flex-col items-center gap-1 rounded-md border p-1"
      style={{ backgroundColor: palette.buttonBg, borderColor: palette.wrapperBorder }}
    >
      {DRAW_TOOLS.map((t) => {
        const active = drawTool === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onSelect(t.key)}
            aria-pressed={active}
            title={`${t.label} — ${t.hint}`}
            aria-label={t.label}
            className="flex h-8 w-8 items-center justify-center rounded transition-colors"
            style={{
              backgroundColor: active ? palette.buttonActiveBg : "transparent",
              color: active ? palette.buttonActiveText : palette.buttonText,
            }}
          >
            <DrawToolIcon tool={t.key} />
          </button>
        );
      })}
    </div>
  );
}

function ObjectsDropdown({
  showBollinger,
  showVolume,
  showDayBands,
  horizontalLines,
  onRemoveHorizontalLine,
  trendLines,
  onRemoveTrendLine,
  measureLines,
  onRemoveMeasureLine,
  regressionLines,
  onRemoveRegressionLine,
  textBoxes,
  onRemoveTextBox,
  palette,
}: {
  showBollinger: boolean;
  showVolume: boolean;
  showDayBands: boolean;
  horizontalLines: { id: string; price: number }[];
  onRemoveHorizontalLine: (id: string) => void;
  trendLines: { id: string; p1: DrawPoint; p2: DrawPoint }[];
  onRemoveTrendLine: (id: string) => void;
  measureLines: { id: string; p1: DrawPoint; p2: DrawPoint; bars: number }[];
  onRemoveMeasureLine: (id: string) => void;
  regressionLines: { id: string; fromLogical: number; toLogical: number }[];
  onRemoveRegressionLine: (id: string) => void;
  textBoxes: TextBoxState[];
  onRemoveTextBox: (id: string) => void;
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
        Objetos
        <span className="text-[9px] opacity-70">▾</span>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-40 mt-1 min-w-[210px] overflow-hidden rounded border shadow-lg"
          style={{ backgroundColor: palette.buttonBg, borderColor: palette.wrapperBorder }}
        >
          {MA_LINES.map((ma) => (
            <div
              key={ma.key}
              className="flex items-center gap-2 px-3 py-2 font-mono text-xs"
              style={{ color: palette.buttonText }}
            >
              <span
                className="inline-block h-[2px] w-3"
                style={{ backgroundColor: ma.color }}
              />
              {ma.label}
            </div>
          ))}
          {showBollinger && (
            <div
              className="flex items-center gap-2 px-3 py-2 font-mono text-xs"
              style={{ color: palette.buttonText }}
            >
              <span
                className="inline-block h-[2px] w-3"
                style={{ backgroundColor: BOLLINGER_COLOR }}
              />
              Bollinger (20, 2σ)
            </div>
          )}
          {showVolume && (
            <div
              className="flex items-center gap-2 px-3 py-2 font-mono text-xs"
              style={{ color: palette.buttonText }}
            >
              <span className="inline-block h-2 w-3 bg-current opacity-60" />
              Volumen
            </div>
          )}
          {showDayBands && (
            <div
              className="flex items-center gap-2 px-3 py-2 font-mono text-xs"
              style={{ color: palette.buttonText }}
            >
              <span className="inline-block h-2.5 w-3" style={{ backgroundColor: "rgba(212,175,55,0.5)" }} />
              Fondos por día
            </div>
          )}
          {horizontalLines.length === 0 &&
          trendLines.length === 0 &&
          measureLines.length === 0 &&
          regressionLines.length === 0 &&
          textBoxes.length === 0 ? (
            <p
              className="border-t px-3 py-2 font-mono text-[11px] opacity-60"
              style={{ color: palette.textSoft, borderColor: palette.wrapperBorder }}
            >
              Sin dibujos todavía
            </p>
          ) : (
            <>
              {horizontalLines.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-2 border-t px-3 py-2 font-mono text-xs"
                  style={{ color: palette.buttonText, borderColor: palette.wrapperBorder }}
                >
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-[2px] w-3" style={{ backgroundColor: "#60A5FA" }} />
                    Línea {l.price.toFixed(2)}
                  </span>
                  <button
                    onClick={() => onRemoveHorizontalLine(l.id)}
                    style={{ color: palette.textSoft }}
                    title="Borrar esta línea"
                    aria-label={`Borrar línea en ${l.price.toFixed(2)}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              {trendLines.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-2 border-t px-3 py-2 font-mono text-xs"
                  style={{ color: palette.buttonText, borderColor: palette.wrapperBorder }}
                >
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-[2px] w-3" style={{ backgroundColor: "#F5A623" }} />
                    Tendencia {l.p1.price.toFixed(2)} → {l.p2.price.toFixed(2)}
                  </span>
                  <button
                    onClick={() => onRemoveTrendLine(l.id)}
                    style={{ color: palette.textSoft }}
                    title="Borrar esta tendencia"
                    aria-label="Borrar esta tendencia"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {measureLines.map((l) => {
                const diff = l.p2.price - l.p1.price;
                const pct = l.p1.price !== 0 ? (diff / l.p1.price) * 100 : 0;
                return (
                  <div
                    key={l.id}
                    className="flex items-center justify-between gap-2 border-t px-3 py-2 font-mono text-xs"
                    style={{ color: palette.buttonText, borderColor: palette.wrapperBorder }}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-3"
                        style={{ backgroundColor: diff >= 0 ? "rgba(8,153,129,0.5)" : "rgba(242,54,69,0.5)" }}
                      />
                      Regla {pct >= 0 ? "+" : ""}
                      {pct.toFixed(2)}% · {l.bars}b
                    </span>
                    <button
                      onClick={() => onRemoveMeasureLine(l.id)}
                      style={{ color: palette.textSoft }}
                      title="Borrar esta regla"
                      aria-label="Borrar esta regla"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
              {regressionLines.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-2 border-t px-3 py-2 font-mono text-xs"
                  style={{ color: palette.buttonText, borderColor: palette.wrapperBorder }}
                >
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-[2px] w-3" style={{ backgroundColor: "#A855F7" }} />
                    Regresión ({Math.abs(Math.round(l.toLogical - l.fromLogical))} barras)
                  </span>
                  <button
                    onClick={() => onRemoveRegressionLine(l.id)}
                    style={{ color: palette.textSoft }}
                    title="Borrar este canal de regresión"
                    aria-label="Borrar este canal de regresión"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {textBoxes.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-2 border-t px-3 py-2 font-mono text-xs"
                  style={{ color: palette.buttonText, borderColor: palette.wrapperBorder }}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="inline-block h-2.5 w-3 border" style={{ borderColor: "#F5A623" }} />
                    Texto{t.text ? `: ${t.text.slice(0, 20)}` : " (vacío)"}
                  </span>
                  <button
                    onClick={() => onRemoveTextBox(t.id)}
                    style={{ color: palette.textSoft }}
                    title="Borrar este cuadro de texto"
                    aria-label="Borrar este cuadro de texto"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </>
          )}
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
  // Líneas horizontales que se han dibujado a mano — solo el precio hace
  // falta guardarlo acá, el objeto real de lightweight-charts vive en
  // horizontalLineObjectsRef.
  const [horizontalLines, setHorizontalLines] = useState<
    { id: string; price: number }[]
  >([]);
  // Líneas de tendencia y mediciones — se trazan con clic-arrastrar-soltar
  // (ver dragStartRef más abajo), por eso guardan los dos puntos finales.
  const [trendLines, setTrendLines] = useState<
    { id: string; p1: DrawPoint; p2: DrawPoint }[]
  >([]);
  const [measureLines, setMeasureLines] = useState<
    { id: string; p1: DrawPoint; p2: DrawPoint; bars: number }[]
  >([]);
  const [regressionLines, setRegressionLines] = useState<
    { id: string; fromLogical: number; toLogical: number }[]
  >([]);
  // Cuadros de texto libre — a diferencia de los demás dibujos no son
  // ISeriesPrimitive, son <div> de verdad superpuestos al gráfico (ver
  // TextBoxState más arriba). `textBoxPixels` es la posición en píxeles ya
  // calculada de cada uno (se recalcula junto con la insignia de precio en
  // updatePriceY, cada vez que cambia el zoom/desplazamiento/tamaño).
  const [textBoxes, setTextBoxes] = useState<TextBoxState[]>([]);
  const [textBoxPixels, setTextBoxPixels] = useState<
    Record<string, { x: number; y: number }>
  >({});
  // Qué herramienta de dibujo está activa — "none" es el estado normal
  // (clics solo mueven el cursor). Con una herramienta activa, el próximo
  // clic (o los próximos dos, para tendencia/regla/regresión) dibuja en
  // vez de nada.
  const [drawTool, setDrawTool] = useState<DrawTool>("none");
  // Fondos alternados por día (ver DayBandsPrimitive) — apagado por
  // defecto, igual que Bollinger.
  const [showDayBands, setShowDayBands] = useState(false);

  const palette = PALETTES[theme];

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const maSeriesRef = useRef<Record<string, ISeriesApi<"Line">>>({});
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<"Line"> | null>(null);
  // Objetos dibujados, indexados por el mismo id que su estado (arriba) —
  // para poder desprenderlos de lightweight-charts cuando se borran.
  const horizontalLineObjectsRef = useRef<Record<string, IPriceLine>>({});
  const trendLineObjectsRef = useRef<Record<string, TrendLinePrimitive>>({});
  const measureObjectsRef = useRef<Record<string, MeasurePrimitive>>({});
  const regressionObjectsRef = useRef<Record<string, RegressionChannelPrimitive>>({});
  // Se crea una sola vez (en el efecto que crea el gráfico) y se
  // adjunta/desprende según `showDayBands` — a diferencia de los dibujos de
  // arriba, no representa un punto fijo: lee las velas y el marco de tiempo
  // en vivo (vía dataRef/timeframeRef) en cada repintado.
  const dayBandsPrimitiveRef = useRef<DayBandsPrimitive | null>(null);
  // El clic del gráfico se suscribe una sola vez (mismo efecto que crea el
  // gráfico), así que necesita esta copia siempre actualizada para saber qué
  // herramienta está activa en el momento del clic — el mismo patrón que
  // `dataRef` un poco más abajo.
  const drawToolRef = useRef<DrawTool>("none");
  // Punto de partida del arrastre (tendencia/regla/regresión) — se fija en
  // el mousedown y se usa al soltar para crear el objeto definitivo.
  const dragStartRef = useRef<DrawPoint | null>(null);
  const isDraggingRef = useRef(false);
  // Último punto bajo el cursor, actualizado en cada `subscribeCrosshairMove`
  // — de ahí sale el punto de partida al presionar (no hace falta calcular
  // coordenadas a mano en el mousedown) y el punto final mientras se
  // arrastra.
  const lastHoverPointRef = useRef<DrawPoint | null>(null);
  // Copia en píxeles del mismo punto (no lógica/precio) — la necesita el
  // hit-test de los tiradores (hitTestHandle), que compara contra las
  // coordenadas de pantalla donde se dibujan los círculos, no contra valores
  // lógicos.
  const lastHoverPixelRef = useRef<{ x: number; y: number } | null>(null);
  // Cuando el cursor agarra el tirador de una tendencia/regla YA dibujada
  // (drawTool en "none" pero mousedown cayó sobre un círculo) — mueve ESE
  // punto en vez de dibujar uno nuevo. Es lo que permite "subir o bajar" una
  // línea después de trazada, no solo trazarla una vez.
  const editingRef = useRef<{
    kind: "trend" | "measure";
    id: string;
    handle: "p1" | "p2";
  } | null>(null);
  // El dibujo "en vivo" que se ve mientras se arrastra — se reemplaza por
  // uno definitivo (agregado a horizontalLines/trendLines/etc.) al soltar,
  // o se descarta si el arrastre fue demasiado corto para ser intencional.
  const liveTrendRef = useRef<TrendLinePrimitive | null>(null);
  const liveMeasureRef = useRef<MeasurePrimitive | null>(null);
  // Copia siempre actualizada de `textBoxes` — la necesitan los handlers de
  // arrastre/redimensión (agregados a `window`, creados fuera del ciclo de
  // renders de React) para leer la posición/tamaño de partida sin quedarse
  // con un valor viejo.
  const textBoxesRef = useRef<TextBoxState[]>([]);
  // El <div contentEditable> de cada cuadro — para poder enfocarlo recién
  // creado y para leer/poner su texto sin pelear con React por el cursor
  // (ver el `ref` callback donde se usa: solo pone `textContent` la
  // primera vez que ve ese nodo, nunca en renders posteriores).
  const textBoxContentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Id del cuadro recién creado que hay que enfocar apenas termine de
  // pintarse — se dispara desde el efecto que sincroniza `textBoxesRef`.
  const pendingFocusTextBoxIdRef = useRef<string | null>(null);
  const draggingTextBoxRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    startLogical: number;
    startPrice: number;
  } | null>(null);
  const resizingTextBoxRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);
  const liveRegressionRef = useRef<RegressionChannelPrimitive | null>(null);
  // Copia siempre actualizada de `data`, para leerla desde callbacks creados
  // una sola vez (como el de resize) sin quedarse con datos viejos.
  const dataRef = useRef<CandleSeries | null>(null);
  // Copia siempre actualizada de `timeframe` — la usa DayBandsPrimitive para
  // saber si el marco actual es intradía sin tener que recrearse cada vez
  // que se cambia de marco.
  const timeframeRef = useRef<TimeframeKey>("1h");
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
    if (candles && candles.length > 0 && series) {
      const lastClose = candles[candles.length - 1].close;
      setPriceY(series.priceToCoordinate(lastClose));
    }

    // Misma idea para los cuadros de texto: su posición en pantalla depende
    // del zoom/desplazamiento actual del gráfico, así que se recalcula en
    // los mismos disparadores que la insignia de precio de arriba.
    const chart = chartRef.current;
    if (chart && series) {
      const next: Record<string, { x: number; y: number }> = {};
      for (const box of textBoxesRef.current) {
        const x = logicalToX(chart, box.logical);
        const boxY = series.priceToCoordinate(box.price);
        if (x !== null && boxY !== null) next[box.id] = { x, y: boxY };
      }
      setTextBoxPixels(next);
    }
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
    dayBandsPrimitiveRef.current = new DayBandsPrimitive(
      chart,
      () => dataRef.current?.candles,
      () => INTRADAY_TIMEFRAMES.has(timeframeRef.current)
    );

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

    // Modo dibujo — libre de verdad: clic, arrastrar, soltar, viendo la
    // línea seguir el cursor todo el tiempo (como cualquier herramienta de
    // dibujo real, no un "clic aquí, clic allá" desconectado donde el
    // resultado puede sorprender). `subscribeCrosshairMove` hace el trabajo
    // de convertir la posición del mouse en tiempo/precio — mousedown y
    // mouseup del contenedor solo marcan cuándo empieza y termina el
    // arrastre.
    function onCrosshairMove(param: {
      point?: { x: number; y: number };
      time?: Time;
    }) {
      const series = candleSeriesRef.current;
      if (!param.point || !series) {
        lastHoverPointRef.current = null;
        lastHoverPixelRef.current = null;
        return;
      }
      const price = series.coordinateToPrice(param.point.y);
      const logical = chart.timeScale().coordinateToLogical(param.point.x);
      if (price === null || logical === null) {
        lastHoverPointRef.current = null;
        lastHoverPixelRef.current = null;
        return;
      }
      const point: DrawPoint = { logical, price };
      lastHoverPointRef.current = point;
      lastHoverPixelRef.current = { x: param.point.x, y: param.point.y };

      // Arrastrando el tirador de un dibujo YA existente (ver editingRef) -
      // manda sobre dibujar uno nuevo, aunque en la práctica no compiten
      // porque esto solo se arma con drawTool en "none".
      const editing = editingRef.current;
      if (editing) {
        if (editing.kind === "trend") {
          const primitive = trendLineObjectsRef.current[editing.id];
          if (primitive) {
            const other = editing.handle === "p1" ? primitive.p2 : primitive.p1;
            primitive.setPoints(
              editing.handle === "p1" ? point : other,
              editing.handle === "p1" ? other : point
            );
          }
        } else if (editing.kind === "measure") {
          const primitive = measureObjectsRef.current[editing.id];
          if (primitive) {
            const other = editing.handle === "p1" ? primitive.p2 : primitive.p1;
            const p1 = editing.handle === "p1" ? point : other;
            const p2 = editing.handle === "p1" ? other : point;
            const bars = Math.abs(Math.round(p2.logical) - Math.round(p1.logical));
            primitive.setPoints(p1, p2, bars);
          }
        }
        return;
      }

      if (!isDraggingRef.current || !dragStartRef.current) return;
      const start = dragStartRef.current;
      const tool = drawToolRef.current;
      if (tool === "trend") {
        liveTrendRef.current?.setPoints(start, point);
      } else if (tool === "measure") {
        const bars = Math.abs(Math.round(point.logical) - Math.round(start.logical));
        liveMeasureRef.current?.setPoints(start, point, bars);
      } else if (tool === "regression") {
        liveRegressionRef.current?.setRange(start.logical, point.logical);
      }
    }
    chart.subscribeCrosshairMove(onCrosshairMove);

    function onMouseDown() {
      const tool = drawToolRef.current;
      const series = candleSeriesRef.current;

      // Sin herramienta activa: el único clic que hace algo es sobre el
      // tirador de una tendencia/regla ya dibujada, para agarrarla y
      // moverla. Se desactiva el paneo/zoom del gráfico mientras dura el
      // arrastre, si no cada intento de mover el punto también arrastraría
      // el gráfico entero por debajo.
      if (tool === "none") {
        const pixel = lastHoverPixelRef.current;
        if (!pixel) return;
        for (const [id, primitive] of Object.entries(trendLineObjectsRef.current)) {
          const handle = primitive.hitTestHandle(pixel.x, pixel.y);
          if (handle) {
            editingRef.current = { kind: "trend", id, handle };
            chart.applyOptions({ handleScroll: false, handleScale: false });
            return;
          }
        }
        for (const [id, primitive] of Object.entries(measureObjectsRef.current)) {
          const handle = primitive.hitTestHandle(pixel.x, pixel.y);
          if (handle) {
            editingRef.current = { kind: "measure", id, handle };
            chart.applyOptions({ handleScroll: false, handleScale: false });
            return;
          }
        }
        return;
      }

      const start = lastHoverPointRef.current;
      if (!series || !start) return;

      if (tool === "horizontal") {
        addHorizontalLine(start.price);
        setDrawTool("none");
        return;
      }

      if (tool === "text") {
        addTextBox(start);
        setDrawTool("none");
        return;
      }

      dragStartRef.current = start;
      isDraggingRef.current = true;

      if (tool === "trend") {
        const primitive = new TrendLinePrimitive(chart, series, start, start);
        series.attachPrimitive(primitive);
        liveTrendRef.current = primitive;
      } else if (tool === "measure") {
        const primitive = new MeasurePrimitive(chart, series, start, start, 0);
        series.attachPrimitive(primitive);
        liveMeasureRef.current = primitive;
      } else if (tool === "regression") {
        const primitive = new RegressionChannelPrimitive(
          chart,
          series,
          start.logical,
          start.logical,
          () => dataRef.current?.candles
        );
        series.attachPrimitive(primitive);
        liveRegressionRef.current = primitive;
      }
    }

    function onMouseUp() {
      // Se estaba arrastrando el tirador de un dibujo existente, no
      // dibujando uno nuevo: confirma la posición final en el estado de
      // React (para que el panel de Objetos y cualquier futura persistencia
      // queden al día) y reactiva el paneo/zoom del gráfico.
      const editing = editingRef.current;
      if (editing) {
        editingRef.current = null;
        chart.applyOptions({ handleScroll: true, handleScale: true });
        if (editing.kind === "trend") {
          const primitive = trendLineObjectsRef.current[editing.id];
          if (primitive) {
            const { p1, p2 } = primitive;
            setTrendLines((prev) =>
              prev.map((l) => (l.id === editing.id ? { ...l, p1, p2 } : l))
            );
          }
        } else if (editing.kind === "measure") {
          const primitive = measureObjectsRef.current[editing.id];
          if (primitive) {
            const { p1, p2, barsBetween } = primitive;
            setMeasureLines((prev) =>
              prev.map((l) =>
                l.id === editing.id ? { ...l, p1, p2, bars: barsBetween } : l
              )
            );
          }
        }
        return;
      }

      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      const tool = drawToolRef.current;
      const start = dragStartRef.current;
      const end = lastHoverPointRef.current;
      dragStartRef.current = null;
      const series = candleSeriesRef.current;

      // Se descarta si el arrastre fue tan corto que no se ve distinto de
      // un clic sin querer — mejor no dejar una línea de un solo punto.
      const huboMovimiento =
        !!start && !!end && (start.logical !== end.logical || start.price !== end.price);

      if (tool === "trend" && liveTrendRef.current) {
        if (series) series.detachPrimitive(liveTrendRef.current);
        liveTrendRef.current = null;
        if (huboMovimiento && start && end) addTrendLine(start, end);
      } else if (tool === "measure" && liveMeasureRef.current) {
        if (series) series.detachPrimitive(liveMeasureRef.current);
        liveMeasureRef.current = null;
        if (huboMovimiento && start && end) addMeasure(start, end);
      } else if (tool === "regression" && liveRegressionRef.current) {
        if (series) series.detachPrimitive(liveRegressionRef.current);
        liveRegressionRef.current = null;
        if (huboMovimiento && start && end) addRegression(start.logical, end.logical);
      }
      setDrawTool("none");
    }
    containerRef.current.addEventListener("mousedown", onMouseDown);
    // En `window`, no en el contenedor: si sueltan el botón fuera del
    // gráfico (arrastraron hacia afuera) el arrastre igual debe terminar.
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(updatePriceY);
      chart.unsubscribeCrosshairMove(onCrosshairMove);
      containerRef.current?.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
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

  // Los dibujos (línea horizontal, tendencia, regla, regresión) se hacen a
  // mano y no se guardan en ningún lado todavía (no hay dónde persistir
  // dibujos por símbolo) — cambiar de símbolo los borra todos, para no
  // dejar, por ejemplo, una línea de AAPL a $150 pegada encima de un
  // gráfico de GLD que se mueve en otro rango de precio por completo.
  // Fondos por día NO se toca acá: no es un dibujo puntual sino un
  // interruptor que se mantiene igual sin importar el símbolo.
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (series) {
      for (const line of Object.values(horizontalLineObjectsRef.current)) {
        series.removePriceLine(line);
      }
      for (const primitive of Object.values(trendLineObjectsRef.current)) {
        series.detachPrimitive(primitive);
      }
      for (const primitive of Object.values(measureObjectsRef.current)) {
        series.detachPrimitive(primitive);
      }
      for (const primitive of Object.values(regressionObjectsRef.current)) {
        series.detachPrimitive(primitive);
      }
      // Por si el símbolo cambió a mitad de un arrastre (raro, pero
      // posible) — se desprende también el dibujo "en vivo".
      if (liveTrendRef.current) series.detachPrimitive(liveTrendRef.current);
      if (liveMeasureRef.current) series.detachPrimitive(liveMeasureRef.current);
      if (liveRegressionRef.current) series.detachPrimitive(liveRegressionRef.current);
    }
    horizontalLineObjectsRef.current = {};
    trendLineObjectsRef.current = {};
    measureObjectsRef.current = {};
    regressionObjectsRef.current = {};
    liveTrendRef.current = null;
    liveMeasureRef.current = null;
    liveRegressionRef.current = null;
    setHorizontalLines([]);
    setTrendLines([]);
    setMeasureLines([]);
    setRegressionLines([]);
    // Los cuadros de texto no son primitivos de canvas (son <div>, ver
    // TextBoxState), así que no hay nada que desprender de `series` — solo
    // vaciar el estado y sus refs.
    textBoxContentRefs.current = {};
    pendingFocusTextBoxIdRef.current = null;
    setTextBoxes([]);
    setTextBoxPixels({});
    dragStartRef.current = null;
    isDraggingRef.current = false;
    // Por si el símbolo cambió a mitad de un arrastre de un tirador (mismo
    // caso raro de arriba) — si no se limpia, el paneo/zoom del gráfico
    // quedaría desactivado hasta el próximo mouseup.
    if (editingRef.current) {
      chartRef.current?.applyOptions({ handleScroll: true, handleScale: true });
      editingRef.current = null;
    }
    if (draggingTextBoxRef.current) {
      draggingTextBoxRef.current = null;
      window.removeEventListener("mousemove", onDragTextBoxMove);
      window.removeEventListener("mouseup", onDragTextBoxUp);
    }
    if (resizingTextBoxRef.current) {
      resizingTextBoxRef.current = null;
      window.removeEventListener("mousemove", onResizeTextBoxMove);
      window.removeEventListener("mouseup", onResizeTextBoxUp);
    }
    setDrawTool("none");
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!INTRADAY_TIMEFRAMES.has(timeframe)) return;
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

  useEffect(() => {
    timeframeRef.current = timeframe;
  }, [timeframe]);

  useEffect(() => {
    drawToolRef.current = drawTool;
  }, [drawTool]);

  // Copia siempre actualizada para los handlers de arrastre/redimensión, y
  // recalcula posiciones en píxeles (por si se acaba de agregar/quitar un
  // cuadro, o cambió de tamaño) sin esperar al próximo pan/zoom.
  useEffect(() => {
    textBoxesRef.current = textBoxes;
    updatePriceY();

    const pendingId = pendingFocusTextBoxIdRef.current;
    if (pendingId && textBoxes.some((b) => b.id === pendingId)) {
      pendingFocusTextBoxIdRef.current = null;
      const el = textBoxContentRefs.current[pendingId];
      if (el) {
        el.focus();
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  }, [textBoxes, updatePriceY]);

  // Fondos por día: se adjunta/desprende según el checkbox, en vez de
  // crearse y destruirse — el mismo objeto sirve para todos los símbolos y
  // marcos de tiempo, porque lee las velas en vivo en cada repintado.
  useEffect(() => {
    const series = candleSeriesRef.current;
    const primitive = dayBandsPrimitiveRef.current;
    if (!series || !primitive) return;
    if (showDayBands) {
      series.attachPrimitive(primitive);
      return () => series.detachPrimitive(primitive);
    }
  }, [showDayBands]);

  // Traza una línea horizontal nueva en `price`.
  const addHorizontalLine = useCallback((price: number) => {
    const series = candleSeriesRef.current;
    if (!series) return;
    const id = `${Date.now()}-${Math.random()}`;
    const priceLine = series.createPriceLine({
      price,
      color: "#60A5FA",
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: "",
    });
    horizontalLineObjectsRef.current[id] = priceLine;
    setHorizontalLines((prev) => [...prev, { id, price }]);
  }, []);

  const removeHorizontalLine = useCallback((id: string) => {
    const series = candleSeriesRef.current;
    const priceLine = horizontalLineObjectsRef.current[id];
    if (series && priceLine) series.removePriceLine(priceLine);
    delete horizontalLineObjectsRef.current[id];
    setHorizontalLines((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const addTrendLine = useCallback((p1: DrawPoint, p2: DrawPoint) => {
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!chart || !series) return;
    const id = `${Date.now()}-${Math.random()}`;
    const primitive = new TrendLinePrimitive(chart, series, p1, p2);
    series.attachPrimitive(primitive);
    trendLineObjectsRef.current[id] = primitive;
    setTrendLines((prev) => [...prev, { id, p1, p2 }]);
  }, []);

  const removeTrendLine = useCallback((id: string) => {
    const series = candleSeriesRef.current;
    const primitive = trendLineObjectsRef.current[id];
    if (series && primitive) series.detachPrimitive(primitive);
    delete trendLineObjectsRef.current[id];
    setTrendLines((prev) => prev.filter((l) => l.id !== id));
  }, []);

  // Cuántas velas hay entre los dos puntos de la regla — parte de lo que
  // muestra la etiqueta ("0,51 (0,58%) 6 barras", igual que TradingView).
  const addMeasure = useCallback((p1: DrawPoint, p2: DrawPoint) => {
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!chart || !series) return;
    const bars = Math.abs(Math.round(p2.logical) - Math.round(p1.logical));
    const id = `${Date.now()}-${Math.random()}`;
    const primitive = new MeasurePrimitive(chart, series, p1, p2, bars);
    series.attachPrimitive(primitive);
    measureObjectsRef.current[id] = primitive;
    setMeasureLines((prev) => [...prev, { id, p1, p2, bars }]);
  }, []);

  const removeMeasure = useCallback((id: string) => {
    const series = candleSeriesRef.current;
    const primitive = measureObjectsRef.current[id];
    if (series && primitive) series.detachPrimitive(primitive);
    delete measureObjectsRef.current[id];
    setMeasureLines((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const addRegression = useCallback((logical1: number, logical2: number) => {
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!chart || !series) return;
    const fromLogical = Math.min(logical1, logical2);
    const toLogical = Math.max(logical1, logical2);
    const id = `${Date.now()}-${Math.random()}`;
    const primitive = new RegressionChannelPrimitive(
      chart,
      series,
      fromLogical,
      toLogical,
      () => dataRef.current?.candles
    );
    series.attachPrimitive(primitive);
    regressionObjectsRef.current[id] = primitive;
    setRegressionLines((prev) => [...prev, { id, fromLogical, toLogical }]);
  }, []);

  const removeRegression = useCallback((id: string) => {
    const series = candleSeriesRef.current;
    const primitive = regressionObjectsRef.current[id];
    if (series && primitive) series.detachPrimitive(primitive);
    delete regressionObjectsRef.current[id];
    setRegressionLines((prev) => prev.filter((l) => l.id !== id));
  }, []);

  // Cuadro de texto — un solo clic lo coloca (como la línea horizontal) con
  // un tamaño y texto por defecto, y queda pendiente de foco (ver el efecto
  // que sincroniza textBoxesRef) para que el cursor ya esté listo para
  // escribir sin un segundo clic aparte.
  const addTextBox = useCallback((point: DrawPoint) => {
    const id = `${Date.now()}-${Math.random()}`;
    pendingFocusTextBoxIdRef.current = id;
    setTextBoxes((prev) => [
      ...prev,
      {
        id,
        logical: point.logical,
        price: point.price,
        width: 160,
        height: 68,
        text: "",
        fontSize: 12,
        align: "left",
      },
    ]);
  }, []);

  const removeTextBox = useCallback((id: string) => {
    delete textBoxContentRefs.current[id];
    setTextBoxes((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const setTextBoxFontSize = useCallback((id: string, delta: number) => {
    setTextBoxes((prev) =>
      prev.map((b) =>
        b.id === id
          ? {
              ...b,
              fontSize: Math.max(
                TEXT_BOX_MIN_FONT,
                Math.min(TEXT_BOX_MAX_FONT, b.fontSize + delta)
              ),
            }
          : b
      )
    );
  }, []);

  const toggleTextBoxAlign = useCallback((id: string) => {
    setTextBoxes((prev) =>
      prev.map((b) => (b.id === id ? { ...b, align: b.align === "center" ? "left" : "center" } : b))
    );
  }, []);

  // Se llama en cada `onInput` del contentEditable — deliberadamente no se
  // vuelve a poner ese texto de vuelta en el <div> (eso pelearía con la
  // posición del cursor mientras se escribe); solo se guarda para el panel
  // de Objetos y para que sobreviva un re-render por otra razón.
  const commitTextBoxText = useCallback((id: string, text: string) => {
    setTextBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, text } : b)));
  }, []);

  const onDragTextBoxMove = useCallback((e: MouseEvent) => {
    const drag = draggingTextBoxRef.current;
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!drag || !chart || !series) return;
    const anchorX = logicalToX(chart, drag.startLogical);
    const anchorY = series.priceToCoordinate(drag.startPrice);
    if (anchorX === null || anchorY === null) return;
    const newLogical = chart.timeScale().coordinateToLogical(anchorX + (e.clientX - drag.startX));
    const newPrice = series.coordinateToPrice(anchorY + (e.clientY - drag.startY));
    if (newLogical === null || newPrice === null) return;
    setTextBoxes((prev) =>
      prev.map((b) => (b.id === drag.id ? { ...b, logical: newLogical, price: newPrice } : b))
    );
  }, []);

  const onDragTextBoxUp = useCallback(() => {
    draggingTextBoxRef.current = null;
    window.removeEventListener("mousemove", onDragTextBoxMove);
    window.removeEventListener("mouseup", onDragTextBoxUp);
  }, [onDragTextBoxMove]);

  // Arrastrar desde la franja superior del cuadro lo mueve — el ancla
  // (logical/price) sigue al gráfico si se hace pan/zoom mientras tanto,
  // por eso se recalcula su posición en píxeles de partida (`anchorX`/`Y`)
  // en cada mousemove en vez de asumir que no cambió.
  const startDragTextBox = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      e.preventDefault();
      const box = textBoxesRef.current.find((b) => b.id === id);
      if (!box) return;
      draggingTextBoxRef.current = {
        id,
        startX: e.clientX,
        startY: e.clientY,
        startLogical: box.logical,
        startPrice: box.price,
      };
      window.addEventListener("mousemove", onDragTextBoxMove);
      window.addEventListener("mouseup", onDragTextBoxUp);
    },
    [onDragTextBoxMove, onDragTextBoxUp]
  );

  const onResizeTextBoxMove = useCallback((e: MouseEvent) => {
    const resize = resizingTextBoxRef.current;
    if (!resize) return;
    const width = Math.max(60, resize.startWidth + (e.clientX - resize.startX));
    const height = Math.max(30, resize.startHeight + (e.clientY - resize.startY));
    setTextBoxes((prev) => prev.map((b) => (b.id === resize.id ? { ...b, width, height } : b)));
  }, []);

  const onResizeTextBoxUp = useCallback(() => {
    resizingTextBoxRef.current = null;
    window.removeEventListener("mousemove", onResizeTextBoxMove);
    window.removeEventListener("mouseup", onResizeTextBoxUp);
  }, [onResizeTextBoxMove]);

  // Tirador en la esquina inferior derecha — tamaño en píxeles fijo, no
  // sigue el zoom del gráfico (a diferencia de la posición del cuadro).
  const startResizeTextBox = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      e.preventDefault();
      const box = textBoxesRef.current.find((b) => b.id === id);
      if (!box) return;
      resizingTextBoxRef.current = {
        id,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: box.width,
        startHeight: box.height,
      };
      window.addEventListener("mousemove", onResizeTextBoxMove);
      window.addEventListener("mouseup", onResizeTextBoxUp);
    },
    [onResizeTextBoxMove, onResizeTextBoxUp]
  );

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
    const intraday = INTRADAY_TIMEFRAMES.has(timeframe);
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
    if (INTRADAY_TIMEFRAMES.has(timeframe) && data.candles.length > 0) {
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

      // Los marcos intradía arrancan centrados en lo reciente — pero no SOLO
      // en el día en curso: con el mercado recién abierto eso eran apenas
      // 6-7 velas, demasiado apretado (Alejo pidió alejar el zoom para ver
      // más contexto). Se muestran los últimos 3 días hábiles completos (de
      // los que haya cargados) en vez de uno solo — bastantes más velas, sin
      // llegar a las 300 que se piden de fondo para las PM.
      const DIAS_VISIBLES_HORA = 3;
      const diasUnicos = Array.from(
        new Set(data.candles.map((c) => Math.floor(c.time / 86400)))
      ).sort((a, b) => a - b);
      const diaDesde = diasUnicos[Math.max(0, diasUnicos.length - DIAS_VISIBLES_HORA)];
      const primeraVisible = data.candles.find(
        (c) => Math.floor(c.time / 86400) >= diaDesde
      );

      chartRef.current?.timeScale().setVisibleRange({
        from: (primeraVisible ?? apertura).time as unknown as UTCTimestamp,
        to: (ultima.time + 3600) as unknown as UTCTimestamp,
      });
    } else {
      candleSeriesRef.current.setMarkers([]);

      // En Día/Semana/Mes se pide de fondo bastante historia (para que las
      // PM de 100 y 200 períodos tengan con qué calcularse), pero a nadie
      // le sirve abrir viendo esa historia entera apretada — hay que
      // arrastrarse hasta la derecha para llegar al precio de hoy. Alejo lo
      // pidió explícitamente pensando en gente mayor a la que le cuesta
      // desplazarse: en vez de `fitContent()` (que muestra el 100% de lo
      // cargado), se muestra solo la mitad más reciente — así ya arranca
      // centrado en el valor actual, con las velas al doble de grandes.
      if (data.candles.length > 1) {
        const mitad = Math.floor(data.candles.length / 2);
        const desde = data.candles[mitad].time;
        const ultima = data.candles[data.candles.length - 1].time;
        // Un margen a la derecha (5% del tramo mostrado) para que la
        // última vela no quede pegada al borde del panel.
        const margen = Math.round((ultima - desde) * 0.05);
        chartRef.current?.timeScale().setVisibleRange({
          from: desde as unknown as UTCTimestamp,
          to: (ultima + margen) as unknown as UTCTimestamp,
        });
      } else {
        chartRef.current?.timeScale().fitContent();
      }
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
          <TimeframeButtons
            value={timeframe}
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
            showDayBands={showDayBands}
            onToggleDayBands={() => setShowDayBands((v) => !v)}
            invertScale={invertScale}
            onToggleInvert={() => setInvertScale((v) => !v)}
            palette={palette}
          />
          <ObjectsDropdown
            showBollinger={showBollinger}
            showVolume={showVolume}
            showDayBands={showDayBands}
            horizontalLines={horizontalLines}
            onRemoveHorizontalLine={removeHorizontalLine}
            trendLines={trendLines}
            onRemoveTrendLine={removeTrendLine}
            measureLines={measureLines}
            onRemoveMeasureLine={removeMeasure}
            regressionLines={regressionLines}
            onRemoveRegressionLine={removeRegression}
            textBoxes={textBoxes}
            onRemoveTextBox={removeTextBox}
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

      <div className={fillHeight ? "flex min-h-0 flex-1 gap-1.5" : "flex gap-1.5"}>
        {/* Barra vertical de dibujo, siempre a la vista sobre el borde
            izquierdo del gráfico (como TradingView) — reemplazó al menú
            desplegable "Dibujar". */}
        <DrawToolbar
          drawTool={drawTool}
          onSelect={(t) => setDrawTool((prev) => (prev === t ? "none" : t))}
          palette={palette}
        />
        <div className={fillHeight ? "relative min-h-0 flex-1" : "relative flex-1"}>
          <div
            ref={containerRef}
            className={fillHeight ? "h-full w-full" : "w-full"}
            style={drawTool !== "none" ? { cursor: "crosshair" } : undefined}
          />
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
        {/* Capa de cuadros de texto — hermana de containerRef, no hija: así
            un clic sobre un cuadro nunca pasa por el mousedown nativo del
            gráfico (que vive sobre containerRef), y no hace falta pelear
            con el orden de stopPropagation. `pointer-events-none` en el
            contenedor deja pasar el resto de clics al gráfico de abajo;
            cada cuadro se activa individualmente con `pointer-events-auto`. */}
        <div className="pointer-events-none absolute inset-0 z-20">
          {textBoxes.map((box) => {
            const pos = textBoxPixels[box.id];
            if (!pos) return null;
            return (
              <div
                key={box.id}
                className="pointer-events-auto absolute flex flex-col overflow-hidden rounded border"
                style={{
                  left: pos.x,
                  top: pos.y,
                  width: box.width,
                  height: box.height,
                  borderColor: "#F5A623",
                  backgroundColor: "rgba(17,20,24,0.78)",
                }}
              >
                <div
                  className="flex h-5 shrink-0 items-stretch"
                  style={{ backgroundColor: "rgba(245,166,35,0.55)" }}
                >
                  <div
                    className="flex-1 cursor-move"
                    onMouseDown={(e) => startDragTextBox(e, box.id)}
                  />
                  {/* Botones de la mini barra de herramientas: mousedown corta
                      la propagación para no disparar el arrastre del cuadro
                      (que escucha en el mismo mousedown), el onClick sí llega
                      normal. */}
                  <button
                    type="button"
                    title="Achicar letra"
                    aria-label="Achicar letra"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => setTextBoxFontSize(box.id, -2)}
                    className="w-4 shrink-0 font-mono text-[9px] leading-none text-black/80 hover:bg-black/10"
                  >
                    A-
                  </button>
                  <button
                    type="button"
                    title="Agrandar letra"
                    aria-label="Agrandar letra"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => setTextBoxFontSize(box.id, 2)}
                    className="w-4 shrink-0 font-mono text-[9px] leading-none text-black/80 hover:bg-black/10"
                  >
                    A+
                  </button>
                  <button
                    type="button"
                    title="Centrar texto"
                    aria-label="Centrar texto"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => toggleTextBoxAlign(box.id)}
                    className="w-4 shrink-0 font-mono text-[9px] leading-none text-black/80"
                    style={{ backgroundColor: box.align === "center" ? "rgba(0,0,0,0.25)" : "transparent" }}
                  >
                    C
                  </button>
                </div>
                <div
                  ref={(el) => {
                    if (el && textBoxContentRefs.current[box.id] !== el) {
                      textBoxContentRefs.current[box.id] = el;
                      el.textContent = box.text;
                    }
                  }}
                  contentEditable
                  suppressContentEditableWarning
                  className="flex-1 overflow-auto px-1.5 py-1 font-mono text-white outline-none"
                  style={{ wordBreak: "break-word", fontSize: box.fontSize, textAlign: box.align }}
                  onInput={(e) => commitTextBoxText(box.id, e.currentTarget.textContent ?? "")}
                  onMouseDown={(e) => e.stopPropagation()}
                />
                <div
                  onMouseDown={(e) => startResizeTextBox(e, box.id)}
                  className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize"
                  style={{ backgroundColor: "#F5A623" }}
                />
              </div>
            );
          })}
          </div>
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

