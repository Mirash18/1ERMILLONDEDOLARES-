import { NextResponse } from "next/server";
import { getCandles } from "@/lib/marketData";

// Solo el universo gratuito puede pedirse aquí. El universo pagado (Fase 3)
// va en una ruta aparte, protegida por la verificación de suscripción.
// Se probó a pedir el índice S&P 500 (símbolos SPX y GSPC) y Twelve Data
// devuelve 404: su plan actual no sirve índices, solo acciones y ETFs. Por eso
// el gráfico muestra SPY, que es el ETF que replica al índice a una décima
// parte de su valor.
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

  // El navegador pide `fresh=1` justo al cruzar el cambio de hora, para que
  // la vela nueva salga al instante sin esperar al caché del servidor.
  const fresh = searchParams.get("fresh") === "1";

  const series = await getCandles(symbol, interval, 180, fresh);
  return NextResponse.json(series);
}
