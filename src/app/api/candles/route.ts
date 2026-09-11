import { NextResponse } from "next/server";
import { getCandles } from "@/lib/marketData";

// Solo el universo gratuito puede pedirse aquí. El universo pagado (Fase 3)
// va en una ruta aparte, protegida por la verificación de suscripción.
const FREE_SYMBOLS = new Set(["SPY", "META", "GLD"]);

// Marcos de tiempo que el selector del gráfico puede pedir.
const ALLOWED_INTERVALS = new Set(["1h", "1day", "1week", "1month"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") ?? "SPY").toUpperCase();
  const interval = searchParams.get("interval") ?? "1day";

  if (!FREE_SYMBOLS.has(symbol)) {
    return NextResponse.json(
      { error: "símbolo no disponible en el nivel gratuito" },
      { status: 403 }
    );
  }

  if (!ALLOWED_INTERVALS.has(interval)) {
    return NextResponse.json(
      { error: "intervalo no soportado" },
      { status: 400 }
    );
  }

  const series = await getCandles(symbol, interval);
  return NextResponse.json(series);
}
