import { NextResponse } from "next/server";
import { getCandles, getQuotes } from "@/lib/marketData";
import { FREE_SYMBOLS } from "@/lib/universe";

/**
 * Trabajo diario (ver vercel.json → "crons") que "calienta" la caché de
 * Redis para el universo gratuito (SPY/META/GLD) antes de que abra el
 * mercado — para que quien entre a la portada a primera hora no sea quien,
 * sin saberlo, dispara el primer pedido lento a Twelve Data del día.
 *
 * Decisión de Alejo (17 sept. 2026): esto NO se hace para el universo
 * pagado (S&P 500 + Nasdaq-100, 500+ símbolos) — con el plan gratuito de
 * Twelve Data (800 créditos/día) traer todo eso de una sentada gastaría
 * casi el día completo de golpe, empeorando el problema en vez de
 * resolverlo. Ver docs/ARQUITECTURA.md → "Plan de Twelve Data: Venture
 * ($499/mes) es la solución real". Esto es solo un paliativo barato para
 * la parte gratuita mientras tanto.
 *
 * Protegido con `CRON_SECRET`: Vercel manda automáticamente
 * `Authorization: Bearer <CRON_SECRET>` en cada invocación programada — así
 * nadie más puede llamar esta ruta y gastar créditos a propósito.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  }

  const intervals = ["1h", "1day", "1week", "1month"];
  const symbols = [...FREE_SYMBOLS];

  const resultados = await Promise.all([
    getQuotes(symbols).then(() => ({ tipo: "quotes" as const, ok: true })),
    ...symbols.flatMap((symbol) =>
      intervals.map((interval) =>
        getCandles(symbol, interval, 300).then((series) => ({
          tipo: "candles" as const,
          symbol,
          interval,
          ok: !series.error,
          error: series.error,
        }))
      )
    ),
  ]);

  return NextResponse.json({ warmed: resultados.length, resultados });
}
