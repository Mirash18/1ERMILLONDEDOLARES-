import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/marketData";

// Universo gratuito (Fase 1/2). El universo pagado (S&P 500 / Nasdaq) se
// suma en la Fase 3, detrás de la verificación de suscripción — nunca
// expuesto aquí sin antes revisar el estado de pago en el servidor.
const FREE_SYMBOLS = ["SPY", "META", "GLD"];

export async function GET() {
  const quotes = await getQuotes(FREE_SYMBOLS);
  return NextResponse.json({ quotes });
}
