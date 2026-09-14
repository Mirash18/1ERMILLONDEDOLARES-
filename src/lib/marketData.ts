/**
 * Acceso a datos de mercado vía Twelve Data.
 *
 * Corre SIEMPRE en el servidor — la llave (TWELVEDATA_API_KEY) nunca llega
 * al navegador. Ver docs/ARQUITECTURA.md → "Datos de mercado".
 *
 * OJO: mientras la cuenta esté en el plan gratuito, Twelve Data la marca
 * como "internal non-display usage" — es decir, sirve para desarrollar y
 * probar, pero su licencia NO permite mostrar estos datos a visitantes
 * reales de la página. Antes de salir a producción hay que subir a un
 * plan que sí autorice uso público ("display").
 */

export type Quote = {
  symbol: string;
  price: number | null;
  change: number | null;
  percentChange: number | null;
  isMarketOpen: boolean | null;
  error?: string;
};

const TWELVE_DATA_QUOTE_URL = "https://api.twelvedata.com/quote";

export async function getQuotes(symbols: string[]): Promise<Quote[]> {
  const apiKey = process.env.TWELVEDATA_API_KEY;

  if (!apiKey) {
    return symbols.map((symbol) => ({
      symbol,
      price: null,
      change: null,
      percentChange: null,
      isMarketOpen: null,
      error: "TWELVEDATA_API_KEY no configurada en el servidor",
    }));
  }

  const url = `${TWELVE_DATA_QUOTE_URL}?symbol=${encodeURIComponent(
    symbols.join(",")
  )}&apikey=${apiKey}`;

  let res: Response;
  try {
    res = await fetch(url, {
      // Se cachea 30s en el servidor para no gastar de más los créditos
      // del plan gratuito (8 créditos/minuto, 800/día).
      next: { revalidate: 30 },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "error de red";
    return symbols.map((symbol) => ({
      symbol,
      price: null,
      change: null,
      percentChange: null,
      isMarketOpen: null,
      error: message,
    }));
  }

  if (!res.ok) {
    return symbols.map((symbol) => ({
      symbol,
      price: null,
      change: null,
      percentChange: null,
      isMarketOpen: null,
      error: `Twelve Data respondió ${res.status}`,
    }));
  }

  const data = await res.json();

  // Con un solo símbolo, Twelve Data devuelve el objeto plano de la cotización.
  // Con varios símbolos (separados por coma), devuelve { SYMBOL: {...}, ... }.
  const bySymbol: Record<string, Record<string, unknown>> =
    symbols.length === 1 ? { [symbols[0]]: data } : data;

  return symbols.map((symbol) => {
    const entry = bySymbol?.[symbol];
    const entryError =
      typeof entry?.message === "string" ? entry.message : undefined;

    if (!entry || entry.status === "error" || entryError) {
      return {
        symbol,
        price: null,
        change: null,
        percentChange: null,
        isMarketOpen: null,
        error: entryError ?? "sin datos",
      };
    }

    return {
      symbol,
      price: entry.close !== undefined ? Number(entry.close) : null,
      change: entry.change !== undefined ? Number(entry.change) : null,
      percentChange:
        entry.percent_change !== undefined
          ? Number(entry.percent_change)
          : null,
      isMarketOpen:
        typeof entry.is_market_open === "boolean"
          ? entry.is_market_open
          : null,
    };
  });
}

export type Candle = {
  time: number; // Unix timestamp en segundos, siempre en UTC.
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type CandleSeries = {
  symbol: string;
  candles: Candle[];
  // Medias móviles simples, alineadas 1 a 1 con `candles` (null donde no hay
  // suficiente historia todavía). Mismas que se usan en la comunidad:
  // MA20 (amarilla), MA40 (roja), MA100 (verde), MA200 (morada).
  sma20: (number | null)[];
  sma40: (number | null)[];
  sma100: (number | null)[];
  sma200: (number | null)[];
  // Bandas de Bollinger (20 periodos, 2 desviaciones estándar). La banda
  // media coincide con sma20, así que no se repite aquí.
  bbUpper: (number | null)[];
  bbLower: (number | null)[];
  error?: string;
};

const TWELVE_DATA_TIME_SERIES_URL = "https://api.twelvedata.com/time_series";

function simpleMovingAverage(
  closes: number[],
  period: number
): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  let sum = 0;
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i];
    if (i >= period) sum -= closes[i - period];
    if (i >= period - 1) result[i] = sum / period;
  }
  return result;
}

function standardDeviation(values: number[], mean: number): number {
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Bandas de Bollinger clásicas: banda media = SMA(period), bandas superior
 * e inferior = media ± (multiplier × desviación estándar) de esa misma
 * ventana. Implementación de referencia mientras se revisa/ajusta con el
 * código que va a mandar Miguel — ver docs/ARQUITECTURA.md.
 */
function bollingerBands(
  closes: number[],
  period: number = 20,
  multiplier: number = 2
): { upper: (number | null)[]; lower: (number | null)[] } {
  const upper: (number | null)[] = new Array(closes.length).fill(null);
  const lower: (number | null)[] = new Array(closes.length).fill(null);

  for (let i = period - 1; i < closes.length; i++) {
    const window = closes.slice(i - period + 1, i + 1);
    const mean = window.reduce((a, b) => a + b, 0) / period;
    const sd = standardDeviation(window, mean);
    upper[i] = mean + multiplier * sd;
    lower[i] = mean - multiplier * sd;
  }

  return { upper, lower };
}

// Twelve Data entrega la hora en la zona horaria de la bolsa por defecto;
// pedimos UTC explícitamente para poder convertir a timestamp sin ambigüedad.
function toUnixSeconds(datetime: string): number {
  const iso = datetime.includes(" ")
    ? datetime.replace(" ", "T") + "Z"
    : `${datetime}T00:00:00Z`;
  return Math.floor(new Date(iso).getTime() / 1000);
}

// ProRealTime, Investing y TradingView no anclan la vela horaria a la
// apertura del mercado (9:30 en Nueva York) sino al reloj: la primera vela
// del día es parcial — va de 9:30 a 10:00 — y de ahí en adelante van
// completas en 10:00, 11:00, 12:00… Twelve Data, en cambio, entrega la hora
// anclada a la apertura (9:30, 10:30, 11:30…). Para que nuestro marco "Hora"
// se vea igual que en esas plataformas se piden velas de 30 minutos y se
// agrupan aquí por hora de reloj.
//
// El desfase entre UTC y la hora de Nueva York (o la de Colombia) siempre es
// de horas enteras, así que agrupar por hora de UTC da exactamente los mismos
// baldes que agrupar por hora local — no hace falta convertir zonas.
function aggregateToClockHour(candles: Candle[]): Candle[] {
  const out: Candle[] = [];
  let bucket = NaN;

  for (const c of candles) {
    const hour = Math.floor(c.time / 3600);

    if (hour !== bucket) {
      bucket = hour;
      // La marca de tiempo del balde es la de su primera vela, no la hora en
      // punto: así la vela de apertura queda rotulada 9:30 (8:30 en Colombia)
      // y no 9:00, que es justo como se ve en ProRealTime.
      out.push({ ...c });
      continue;
    }

    const last = out[out.length - 1];
    last.high = Math.max(last.high, c.high);
    last.low = Math.min(last.low, c.low);
    last.close = c.close;
    last.volume += c.volume;
  }

  return out;
}

export async function getCandles(
  symbol: string,
  interval: string = "1day",
  outputsize: number = 180
): Promise<CandleSeries> {
  const empty: CandleSeries = {
    symbol,
    candles: [],
    sma20: [],
    sma40: [],
    sma100: [],
    sma200: [],
    bbUpper: [],
    bbLower: [],
  };

  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) {
    return { ...empty, error: "TWELVEDATA_API_KEY no configurada en el servidor" };
  }

  // El marco "Hora" se arma agrupando velas de 30 minutos (ver
  // aggregateToClockHour), así que a Twelve Data se le pide 30min y el doble
  // de velas para cubrir el mismo tramo de historia. Cuesta lo mismo: Twelve
  // Data cobra por llamada, no por vela.
  const isHourly = interval === "1h";
  const requestedInterval = isHourly ? "30min" : interval;
  const requestedOutputsize = isHourly ? outputsize * 2 : outputsize;

  const url =
    `${TWELVE_DATA_TIME_SERIES_URL}?symbol=${encodeURIComponent(symbol)}` +
    `&interval=${encodeURIComponent(requestedInterval)}` +
    `&outputsize=${requestedOutputsize}` +
    `&timezone=UTC&apikey=${apiKey}`;

  let res: Response;
  try {
    res = await fetch(url, {
      // Los marcos intradía se mueven más rápido que los diarios, pero 5 min
      // de caché sigue siendo prudente para no agotar el plan gratuito
      // (8 créditos/minuto, 800/día) en ningún marco de tiempo.
      next: { revalidate: 300 },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "error de red";
    return { ...empty, error: message };
  }

  if (!res.ok) {
    return { ...empty, error: `Twelve Data respondió ${res.status}` };
  }

  const data = await res.json();

  if (data.status === "error" || !Array.isArray(data.values)) {
    return { ...empty, error: data.message ?? "sin datos" };
  }

  type RawValue = {
    datetime: string;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
  };

  // Twelve Data entrega lo más reciente primero; el gráfico necesita orden
  // cronológico ascendente.
  const values = [...(data.values as RawValue[])].reverse();

  const rawCandles: Candle[] = values.map((v) => ({
    time: toUnixSeconds(v.datetime),
    open: Number(v.open),
    high: Number(v.high),
    low: Number(v.low),
    close: Number(v.close),
    volume: Number(v.volume),
  }));

  // Las medias móviles y las Bandas de Bollinger se calculan sobre las velas
  // ya agrupadas — si se calcularan sobre las de 30 minutos darían otro
  // resultado y no coincidirían con lo que se ve en el gráfico.
  const candles = isHourly ? aggregateToClockHour(rawCandles) : rawCandles;

  const closes = candles.map((c) => c.close);
  const bb = bollingerBands(closes, 20, 2);

  return {
    symbol,
    candles,
    sma20: simpleMovingAverage(closes, 20),
    sma40: simpleMovingAverage(closes, 40),
    sma100: simpleMovingAverage(closes, 100),
    sma200: simpleMovingAverage(closes, 200),
    bbUpper: bb.upper,
    bbLower: bb.lower,
  };
}
