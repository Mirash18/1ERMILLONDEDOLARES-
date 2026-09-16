/**
 * Estimación de la próxima fecha de earnings (reporte trimestral de
 * resultados) de una acción, a partir del historial de earnings pasados.
 *
 * Twelve Data sí tiene un calendario de earnings futuro de verdad
 * (`/earnings_calendar`), pero ese endpoint está bloqueado en el plan
 * gratuito — devuelve 403: "available exclusively with grow or pro or
 * ultra or venture or enterprise plans". Mientras tanto, se estima la
 * próxima fecha a partir del patrón de los últimos reportes (las empresas
 * reportan cada ~91 días, con bastante regularidad) usando `/earnings`
 * (histórico), que sí está en el plan gratuito.
 *
 * IMPORTANTE: esto es una ESTIMACIÓN nuestra, no un dato que confirme la
 * empresa ni Twelve Data — se marca así en todas partes donde se muestra.
 * El día que se suba de plan, cambiar esta función para llamar
 * `/earnings_calendar` directamente es lo único que hay que tocar; el resto
 * (ruta, caché, UI) queda igual.
 *
 * Solo aplica a acciones de verdad — los ETFs como SPY o GLD no reportan
 * earnings, así que para esos Twelve Data no devuelve fechas y esta función
 * simplemente no encuentra ninguna (no es un error).
 */

import { getCached, setCached } from "./marketCache";

export type EarningsInfo = {
  symbol: string;
  lastReportDate: string | null;
  nextEstimatedDate: string | null;
  error?: string;
};

const TWELVE_DATA_EARNINGS_URL = "https://api.twelvedata.com/earnings";

// La fecha de un earning no cambia varias veces al día — a diferencia de
// precios y velas, esto puede vivir horas enteras en caché sin que nadie
// note la diferencia. Un día completo alcanza de sobra.
const CACHE_TTL_SECONDS = 24 * 60 * 60;

// Promedia los intervalos entre los últimos reportes (Twelve Data los
// entrega del más reciente al más viejo) y proyecta ese promedio desde el
// último reporte conocido.
function estimateNextDate(pastDatesDesc: string[]): string | null {
  if (pastDatesDesc.length < 2) return null;

  const dates = pastDatesDesc
    .slice(0, 5)
    .map((d) => new Date(`${d}T00:00:00Z`).getTime());

  const intervals: number[] = [];
  for (let i = 0; i < dates.length - 1; i++) {
    intervals.push((dates[i] - dates[i + 1]) / 86_400_000);
  }
  const avgDays = intervals.reduce((a, b) => a + b, 0) / intervals.length;

  return new Date(dates[0] + avgDays * 86_400_000).toISOString().slice(0, 10);
}

export async function getNextEarningsEstimate(
  symbol: string
): Promise<EarningsInfo> {
  const empty: EarningsInfo = {
    symbol,
    lastReportDate: null,
    nextEstimatedDate: null,
  };

  const apiKey = process.env.TWELVEDATA_API_KEY;
  if (!apiKey) {
    return { ...empty, error: "TWELVEDATA_API_KEY no configurada en el servidor" };
  }

  const cacheKey = `earnings:${symbol}`;
  const cached = await getCached<EarningsInfo>(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_SECONDS * 1000) {
    return cached.value;
  }

  function staleOrError(error: string): EarningsInfo {
    return cached?.value ?? { ...empty, error };
  }

  let res: Response;
  try {
    res = await fetch(
      `${TWELVE_DATA_EARNINGS_URL}?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "error de red";
    return staleOrError(message);
  }

  if (!res.ok) {
    return staleOrError(`Twelve Data respondió ${res.status}`);
  }

  const data = await res.json();

  if (data.status === "error" || !Array.isArray(data.earnings)) {
    // Símbolos sin earnings (ETFs como SPY/GLD) caen aquí — no es un error,
    // simplemente no hay nada que estimar. Se guarda igual para no
    // preguntarle a Twelve Data por lo mismo una y otra vez.
    await setCached(cacheKey, empty, CACHE_TTL_SECONDS);
    return empty;
  }

  const dates: string[] = data.earnings.map((e: { date: string }) => e.date);
  const result: EarningsInfo = {
    symbol,
    lastReportDate: dates[0] ?? null,
    nextEstimatedDate: estimateNextDate(dates),
  };

  await setCached(cacheKey, result, CACHE_TTL_SECONDS);
  return result;
}
