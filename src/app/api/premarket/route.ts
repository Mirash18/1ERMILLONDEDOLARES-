import { NextResponse } from "next/server";
import { getExtendedQuote } from "@/lib/marketData";

// Mismo universo gratuito que /api/candles. El universo pagado (Fase 3) irá
// en una ruta aparte, detrás de la verificación de suscripción.
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

  const quote = await getExtendedQuote(symbol);
  return NextResponse.json(quote);
}
