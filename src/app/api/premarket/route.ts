import { NextResponse } from "next/server";
import { getExtendedQuote } from "@/lib/marketData";
import { getAccess } from "@/lib/subscription";
import { isFreeSymbol, isPaidSymbol } from "@/lib/universe";

/**
 * Mismo criterio de acceso que /api/candles — se quedó desactualizado con
 * solo el universo gratuito cuando se agregó el universo pagado, y el
 * 403 que devolvía para símbolos como AAPL/NFLX tumbaba el gráfico entero
 * en el navegador (ver docs/ARQUITECTURA.md). Corregido el 15 sept. 2026.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") ?? "SPY").toUpperCase();

  if (!isFreeSymbol(symbol)) {
    if (!isPaidSymbol(symbol)) {
      return NextResponse.json(
        { error: "símbolo no reconocido" },
        { status: 404 }
      );
    }
    const access = await getAccess();
    if (!access.allowed) {
      return NextResponse.json(
        { error: "símbolo no disponible en el nivel gratuito" },
        { status: 403 }
      );
    }
  }

  const quote = await getExtendedQuote(symbol);
  return NextResponse.json(quote);
}
