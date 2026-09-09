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
