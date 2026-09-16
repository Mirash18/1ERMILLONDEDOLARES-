import { NextResponse } from "next/server";
import { getNextEarningsEstimate } from "@/lib/earnings";
import { hasSymbolAccess } from "@/lib/subscription";
import { isFreeSymbol, isPaidSymbol } from "@/lib/universe";

// Mismo criterio de acceso que /api/candles y /api/premarket.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") ?? "").toUpperCase();
  const scope = searchParams.get("scope");

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

  const info = await getNextEarningsEstimate(symbol);
  return NextResponse.json(info);
}
