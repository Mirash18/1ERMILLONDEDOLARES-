import { NextResponse } from "next/server";
import { getCandles } from "@/lib/marketData";
import { hasSymbolAccess } from "@/lib/subscription";
import { isFreeSymbol, isPaidSymbol } from "@/lib/universe";

// Marcos de tiempo que el selector del gráfico puede pedir. 5min/15min/30min
// son intervalos nativos de Twelve Data (no necesitan el reagrupado especial
// que sí hace falta para "1h" — ver aggregateToClockHour en marketData.ts).
const ALLOWED_INTERVALS = new Set([
  "5min",
  "15min",
  "30min",
  "1h",
  "1day",
  "1week",
  "1month",
]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") ?? "SPY").toUpperCase();
  const interval = searchParams.get("interval") ?? "1day";
  // `scope=sala` relaja la regla a "solo estar registrado" — ver
  // hasSymbolAccess() en subscription.ts para el porqué.
  const scope = searchParams.get("scope");

  // El universo gratuito se sirve siempre. El universo pagado (S&P 500 /
  // Nasdaq-100, ver src/lib/universe.ts) SOLO si el servidor confirma
  // acceso — nunca se confía en nada que diga el navegador.
  if (!isFreeSymbol(symbol)) {
    if (!isPaidSymbol(symbol)) {
      return NextResponse.json(
        { error: "símbolo no reconocido" },
        { status: 404 }
      );
    }
    if (!(await hasSymbolAccess(scope))) {
      return NextResponse.json(
        { error: "símbolo no disponible en el nivel gratuito" },
        { status: 403 }
      );
    }
  }

  if (!ALLOWED_INTERVALS.has(interval)) {
    return NextResponse.json(
      { error: "intervalo no soportado" },
      { status: 400 }
    );
  }

  // El navegador pide `fresh=1` justo al cruzar el cambio de hora, para que
  // la vela nueva salga al instante sin esperar al caché del servidor.
  const fresh = searchParams.get("fresh") === "1";

  const series = await getCandles(symbol, interval, 300, fresh);
  return NextResponse.json(series);
}
