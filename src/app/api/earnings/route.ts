import { NextResponse } from "next/server";
import { getNextEarningsEstimate } from "@/lib/earnings";
import { getAccess } from "@/lib/subscription";
import { isFreeSymbol, isPaidSymbol } from "@/lib/universe";

// Mismo criterio de acceso que /api/candles y /api/premarket.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") ?? "").toUpperCase();

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

  const info = await getNextEarningsEstimate(symbol);
  return NextResponse.json(info);
}
