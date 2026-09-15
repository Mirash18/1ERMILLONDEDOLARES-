import { NextResponse } from "next/server";
import { getAccess } from "@/lib/subscription";
import { FREE_SYMBOLS, PAID_SYMBOLS } from "@/lib/universe";

/**
 * Qué símbolos puede pedir quien está haciendo la petición, ahora mismo.
 * `free` siempre va; `paid` solo si `getAccess()` dice que sí — la misma
 * verificación de servidor que usa `/api/candles` para no dejar pasar a
 * nadie que no deba.
 */
export async function GET() {
  const access = await getAccess();
  return NextResponse.json({
    free: FREE_SYMBOLS,
    paid: access.allowed ? PAID_SYMBOLS : [],
    allowed: access.allowed,
  });
}
