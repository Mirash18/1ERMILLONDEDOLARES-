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

import { getCached, setCached, cacheTtlSeconds } from "./marketCache";

export type Quote = {
  symbol: string;
  price: number | null;
  change: number | null;
  percentChange: number | null;
  isMarketOpen: boolean | null;
  error?: string;
};

const TWELVE_DATA_QUOTE_URL = "https://api.twelvedata.com/quote";

function errorQuote(symbol: string, error: string): Quote {
  return {
    symbol,
    price: null,
    change: null,
    percentChange: null,
    isMarketOpen: null,
    error,
  };
}

/**
 * Cotizaciones para una lista de símbolos — cacheadas UNA POR SÍMBOLO, no
 * por la combinación pedida. Antes se cacheaba por `symbols.join(",")`, así
 * que dos listas de seguimiento distintas que compartieran, digamos, AAPL,
 * no se beneficiaban la una de la caché de la otra — cada combinación
 * nueva volvía a gastar créditos por símbolos que ya se tenían guardados.
 * Con la lista de seguimiento de la Sala de Trading (cada usuario arma la
 * suya) esto importa de verdad.
 */
export async function getQuotes(symbols: string[]): Promise<Quote[]> {
  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) {
    return symbols.map((s) =>
      errorQuote(s, "TWELVEDATA_API_KEY no configurada en el servidor")
    );
  }
  if (symbols.length === 0) return [];

  const session = nyMarketSession();
  const ttlMs = cacheTtlSeconds(session) * 1000;

  // Qué ya se tiene fresco en caché, y qué toca pedirle a Twelve Data.
  const cachedEntries = await Promise.all(
    symbols.map((s) => getCached<Quote>(`quote:${s}`))
  );
  const results = new Map<string, Quote>();
  const missing: string[] = [];
  symbols.forEach((s, i) => {
    const entry = cachedEntries[i];
    if (entry && Date.now() - entry.fetchedAt < ttlMs) {
      results.set(s, entry.value);
    } else {
      missing.push(s);
    }
  });

  if (missing.length === 0) {
    return symbols.map((s) => results.get(s)!);
  }

  // Si Twelve Data falla, un símbolo con algo guardado (aunque ya esté
  // vencido) muestra ESE precio en vez de "sin datos" — sirve más un precio
  // de hace un rato que una pantalla en blanco.
  function staleOrError(symbol: string, i: number, error: string): Quote {
    return cachedEntries[i]?.value ?? errorQuote(symbol, error);
  }

  const url = `${TWELVE_DATA_QUOTE_URL}?symbol=${encodeURIComponent(
    missing.join(",")
  )}&apikey=${apiKey}`;

  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate: 30 } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "error de red";
    missing.forEach((s) => {
      const i = symbols.indexOf(s);
      results.set(s, staleOrError(s, i, message));
    });
    return symbols.map((s) => results.get(s)!);
  }

  if (!res.ok) {
    const message = `Twelve Data respondió ${res.status}`;
    missing.forEach((s) => {
      const i = symbols.indexOf(s);
      results.set(s, staleOrError(s, i, message));
    });
    return symbols.map((s) => results.get(s)!);
  }

  const data = await res.json();

  // Con un solo símbolo, Twelve Data devuelve el objeto plano de la cotización.
  // Con varios símbolos (separados por coma), devuelve { SYMBOL: {...}, ... }.
  const bySymbol: Record<string, Record<string, unknown>> =
    missing.length === 1 ? { [missing[0]]: data } : data;

  for (const symbol of missing) {
    const entry = bySymbol?.[symbol];
    const entryError =
      typeof entry?.message === "string" ? entry.message : undefined;

    const quote: Quote =
      !entry || entry.status === "error" || entryError
        ? errorQuote(symbol, entryError ?? "sin datos")
        : {
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

    results.set(symbol, quote);
    // Solo se guarda si de verdad trajo algo — un error puntual no debe
    // quedar guardado como si fuera el precio real.
    if (quote.price !== null) {
      await setCached(`quote:${symbol}`, quote, cacheTtlSeconds(session));
    }
  }

  return symbols.map((s) => results.get(s)!);
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
  // PM 20 (amarilla), PM 40 (roja), PM 100 (verde), PM 200 (morada).
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
//
// La vela de apertura SIEMPRE abre balde propio, aunque comparta hora de reloj
// con otra. Importa cuando se activen los datos de pre-mercado: la vela de las
// 9:00 y la de la apertura de las 9:30 caen las dos en la hora 13 de UTC, y sin
// esta salvedad se fusionarían — borrando justo la primera vela del día, que es
// la que se mira para saber si el mercado abrió verde o rojo.

// Se crea una sola vez: construir un Intl.DateTimeFormat por cada vela sería
// caro, y aquí se recorren cientos en cada petición.
const NY_HOUR_MINUTE = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function isSessionOpen(timeSeconds: number): boolean {
  const parts = NY_HOUR_MINUTE.formatToParts(new Date(timeSeconds * 1000));
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return Number(get("hour")) % 24 === 9 && Number(get("minute")) === 30;
}

function aggregateToClockHour(candles: Candle[]): Candle[] {
  const out: Candle[] = [];
  let bucket = NaN;

  for (const c of candles) {
    const hour = Math.floor(c.time / 3600);

    if (hour !== bucket || isSessionOpen(c.time)) {
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
  outputsize: number = 300,
  // `fresh` salta el caché del servidor. Se usa solo en el instante en que
  // cambia la hora, para que la vela nueva aparezca al momento en vez de
  // esperar a que expire el caché. Cuesta un crédito por cambio de hora.
  fresh: boolean = false
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

  // Caché persistente (ver marketCache.ts): con el mercado cerrado, las
  // velas del día ya no cambian — se sirven desde acá, sin gastar más
  // créditos, hasta que abra de nuevo. `fresh` la salta a propósito (se usa
  // justo al cruzar el cambio de hora, para no quedarse con la vela vieja).
  // Asume que `outputsize` es siempre 300 (el único valor que pide el
  // proyecto hoy — antes era 180, muy poco para que la MA/PM de 200
  // períodos tuviera con qué calcularse: hacían falta 200 velas solo para
  // el primer punto, así que la línea nunca llegaba a dibujarse. 300 le da
  // holgura para varias decenas de puntos visibles) — si algún día varía,
  // hay que meterlo en la llave.
  const cacheKey = `candles:${symbol}:${interval}`;
  const session = nyMarketSession();
  // Se trae aunque sea `fresh` — no para servirla de una (eso lo salta
  // `fresh` a propósito), sino para tener algo a lo que caer si el pedido
  // forzado de todos modos falla.
  const cached = await getCached<CandleSeries>(cacheKey);
  if (!fresh && cached && Date.now() - cached.fetchedAt < cacheTtlSeconds(session) * 1000) {
    return cached.value;
  }

  // Si Twelve Data falla más adelante (429, caído, lo que sea) y hay
  // velas guardadas aunque ya estén viejas, se prefiere mostrar ESAS antes
  // que un gráfico vacío — unas velas de hace un rato sirven más que nada.
  function staleOrError(error: string): CandleSeries {
    return cached?.value ?? { ...empty, error };
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

  // El marco intradía necesita refrescarse rápido mientras el mercado está
  // abierto: si no, la vela en curso se ve congelada. Fuera de sesión, y en
  // los marcos de día/semana/mes, no hace falta y así se ahorran créditos.
  const revalidate = isHourly && session === "regular" ? 60 : 300;

  let res: Response;
  try {
    res = await fetch(
      url,
      fresh ? { cache: "no-store" } : { next: { revalidate } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "error de red";
    return staleOrError(message);
  }

  if (!res.ok) {
    return staleOrError(`Twelve Data respondió ${res.status}`);
  }

  const data = await res.json();

  if (data.status === "error" || !Array.isArray(data.values)) {
    return staleOrError(data.message ?? "sin datos");
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

  const result: CandleSeries = {
    symbol,
    candles,
    sma20: simpleMovingAverage(closes, 20),
    sma40: simpleMovingAverage(closes, 40),
    sma100: simpleMovingAverage(closes, 100),
    sma200: simpleMovingAverage(closes, 200),
    bbUpper: bb.upper,
    bbLower: bb.lower,
  };

  // Solo se guarda si de verdad trajo velas — no queremos que una respuesta
  // vacía quede pegada en caché hasta por 12 horas.
  if (result.candles.length > 0) {
    await setCached(cacheKey, result, cacheTtlSeconds(session));
  }

  return result;
}

// ---------------------------------------------------------------------------
// Pre-mercado / after-hours ("dónde va a amanecer el mercado")
// ---------------------------------------------------------------------------

export type MarketSession = "pre" | "regular" | "post" | "closed";

export type ExtendedQuote = {
  symbol: string;
  session: MarketSession;
  price: number | null;
  change: number | null;
  percentChange: number | null;
  timestamp: number | null;
  error?: string;
};

// En qué tramo de la jornada de Nueva York estamos en este momento. Se calcula
// con la zona horaria real de la bolsa (no con la del servidor, que en Vercel
// es UTC), así que el horario de verano lo maneja solo.
//
//   pre      04:00 – 09:30   (pre-mercado)
//   regular  09:30 – 16:00   (sesión normal)
//   post     16:00 – 20:00   (after-hours)
//   closed   el resto, y los fines de semana
//
// Los festivos de la bolsa no se detectan: en esos días el precio extendido
// simplemente no se mueve, que es un fallo inofensivo.
export function nyMarketSession(now: Date = new Date()): MarketSession {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const weekday = get("weekday");
  if (weekday === "Sat" || weekday === "Sun") return "closed";

  // Algunos entornos devuelven "24" para la medianoche.
  const hours = Number(get("hour")) % 24;
  const minutes = hours * 60 + Number(get("minute"));

  if (minutes >= 4 * 60 && minutes < 9 * 60 + 30) return "pre";
  if (minutes >= 9 * 60 + 30 && minutes < 16 * 60) return "regular";
  if (minutes >= 16 * 60 && minutes < 20 * 60) return "post";
  return "closed";
}

/**
 * Último precio fuera de la sesión regular, para mostrar hacia dónde viene
 * abriendo el mercado — como el "Pre-market" de TradingView.
 *
 * Se cachea UNA HORA a propósito (lo pidió Alejo): el dato de pre-mercado no
 * necesita refrescarse cada minuto y así el consumo de créditos es mínimo —
 * una sola llamada por hora y por símbolo, y solo fuera de la sesión regular.
 *
 * OJO: el parámetro `prepost` de Twelve Data solo está disponible desde el
 * plan Pro (individual) o Venture (business). Con el plan gratuito la llamada
 * no devuelve los campos extendidos; en ese caso esta función responde sin
 * precio y la insignia simplemente no se muestra, sin romper nada más.
 */
export async function getExtendedQuote(symbol: string): Promise<ExtendedQuote> {
  const session = nyMarketSession();
  const base: ExtendedQuote = {
    symbol,
    session,
    price: null,
    change: null,
    percentChange: null,
    timestamp: null,
  };

  // Durante la sesión regular no hay nada extendido que mostrar: el precio
  // normal ya va en la tira de cotizaciones. Además así no se gastan créditos.
  if (session === "regular") return base;

  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) {
    return { ...base, error: "TWELVEDATA_API_KEY no configurada en el servidor" };
  }

  const url =
    `${TWELVE_DATA_QUOTE_URL}?symbol=${encodeURIComponent(symbol)}` +
    `&prepost=true&apikey=${apiKey}`;

  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate: 3600 } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "error de red";
    return { ...base, error: message };
  }

  if (!res.ok) {
    return { ...base, error: `Twelve Data respondió ${res.status}` };
  }

  const data = await res.json();

  if (data.status === "error") {
    return { ...base, error: data.message ?? "sin datos" };
  }

  // Con el plan gratuito estos campos no vienen. No es un error que haya que
  // mostrarle al usuario: simplemente no hay dato extendido disponible.
  if (data.extended_price === undefined) {
    return { ...base, error: "el plan actual no incluye datos de pre-mercado" };
  }

  return {
    symbol,
    session,
    price: Number(data.extended_price),
    change:
      data.extended_change !== undefined ? Number(data.extended_change) : null,
    percentChange:
      data.extended_percent_change !== undefined
        ? Number(data.extended_percent_change)
        : null,
    timestamp:
      data.extended_timestamp !== undefined
        ? Number(data.extended_timestamp)
        : null,
  };
}

