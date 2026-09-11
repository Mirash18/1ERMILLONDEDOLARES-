import { NextResponse } from "next/server";
import { getCandles } from "@/lib/marketData";

// Solo el universo gratuito puede pedirse aquí. El universo pagado (Fase 3)
// va en una ruta aparte, protegida por la verificación de suscripción.
const FREE_SYMBOLS = new Set(["SPY", "META", "GLD"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") ?? "SPY").toUpperCase();

  if (!FREE_SYMBOLS.has(symbol)) {
    return NextResponse.json(
      { error: "símbolo no disponible en el nivel gratuito" },
      { status: 403 }
    );
  }

  const series = await getCandles(symbol);
  return NextResponse.json(series);
}

