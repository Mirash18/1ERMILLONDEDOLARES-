import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/marketData";
import { getAccess, hasSymbolAccess } from "@/lib/subscription";
import { FREE_SYMBOLS, isFreeSymbol, isPaidSymbol } from "@/lib/universe";

/**
 * Sin `symbols`, se comporta como siempre (la tira de precios de la
 * portada: SPY/META/GLD). Con `symbols` (lista separada por comas) sirve
 * la lista de seguimiento de la Sala de Trading — cada símbolo se valida
 * igual que en /api/candles antes de pedirle nada a Twelve Data.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get("symbols");
  const scope = searchParams.get("scope");

  if (!symbolsParam) {
    const [quotes, access] = await Promise.all([
      getQuotes([...FREE_SYMBOLS]),
      getAccess(),
    ]);
    return NextResponse.json({ quotes, allowed: access.allowed });
  }

  const requested = Array.from(
    new Set(
      symbolsParam
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    )
  );

  const canAccessPaid = await hasSymbolAccess(scope);
  const validSymbols = requested.filter(
    (s) => isFreeSymbol(s) || (isPaidSymbol(s) && canAccessPaid)
  );

  const quotes = await getQuotes(validSymbols);
  return NextResponse.json({ quotes, allowed: canAccessPaid });
}
