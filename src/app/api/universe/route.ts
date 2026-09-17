import { NextResponse } from "next/server";
import { getSymbolAccess } from "@/lib/subscription";
import { FREE_SYMBOLS, PAID_SYMBOLS, SECTORS } from "@/lib/universe";

/**
 * Qué símbolos puede pedir quien está haciendo la petición, ahora mismo.
 * `free` siempre va; `paid`/`sectors` solo si hay acceso — `scope=sala` es
 * la Sala de Trading (ver getSymbolAccess() en subscription.ts). Se manda
 * también `status` (no solo `allowed`) para que el navegador pueda mostrar
 * "inicia sesión" o "todavía no tienes acceso" según corresponda, en vez de
 * un mismo mensaje genérico para los dos casos.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");
  const access = await getSymbolAccess(scope);

  return NextResponse.json({
    free: FREE_SYMBOLS,
    paid: access.allowed ? PAID_SYMBOLS : [],
    sectors: access.allowed ? SECTORS : [],
    allowed: access.allowed,
    status: access.status,
  });
}
