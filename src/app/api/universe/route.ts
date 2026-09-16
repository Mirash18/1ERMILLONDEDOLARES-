import { NextResponse } from "next/server";
import { hasSymbolAccess } from "@/lib/subscription";
import { FREE_SYMBOLS, PAID_SYMBOLS, SECTORS } from "@/lib/universe";

/**
 * Qué símbolos puede pedir quien está haciendo la petición, ahora mismo.
 * `free` siempre va; `paid`/`sectors` solo si hay acceso — `scope=sala`
 * relaja esa verificación a "solo estar registrado" (ver
 * hasSymbolAccess() en subscription.ts), para la Sala de Trading.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");
  const allowed = await hasSymbolAccess(scope);

  return NextResponse.json({
    free: FREE_SYMBOLS,
    paid: allowed ? PAID_SYMBOLS : [],
    sectors: allowed ? SECTORS : [],
    allowed,
  });
}
