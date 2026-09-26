import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { randomBytes } from "node:crypto";
import {
  MONEDA_BOLD,
  boldConfigurado,
  firmaIntegridad,
  guardarOrden,
  montoBold,
} from "@/lib/bold";
import { PLANES, type PlanId } from "@/lib/planes";

/**
 * Crea una orden de pago con Bold para el plan elegido (ver lib/bold.ts).
 * Body: `{ plan: "basico" | "premium" | "anual" }`. Responde lo que necesita
 * la pasarela (BoldCheckout) en el navegador — incluida la firma de
 * integridad, que se calcula acá con la llave secreta (nunca sale del
 * servidor). Exige sesión: el pago queda amarrado a la cuenta.
 */
export async function POST(request: Request) {
  if (!boldConfigurado()) {
    return NextResponse.json({ error: "El pago en línea todavía no está disponible." }, { status: 503 });
  }

  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Inicia sesión para pagar." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const plan = PLANES.find((p) => p.id === body?.plan);
  if (!plan) {
    return NextResponse.json({ error: "Plan no válido." }, { status: 400 });
  }

  // Referencia única: letras, números y guiones, máximo 60 (regla de Bold).
  const orderId = `${plan.id}-${Date.now()}-${randomBytes(3).toString("hex")}`;
  const monto = montoBold(plan.id as PlanId);
  const email = user.primaryEmailAddress?.emailAddress ?? null;

  const ok = await guardarOrden({
    orderId,
    userId: user.id,
    email,
    plan: plan.id,
    monto,
    moneda: MONEDA_BOLD,
    creada: Date.now(),
    estado: "pendiente",
  });
  if (!ok) {
    return NextResponse.json({ error: "No se pudo iniciar el pago — intenta de nuevo." }, { status: 500 });
  }

  const nombre = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return NextResponse.json({
    orderId,
    amount: monto,
    currency: MONEDA_BOLD,
    apiKey: process.env.BOLD_IDENTITY_KEY,
    integritySignature: firmaIntegridad(orderId, monto, MONEDA_BOLD),
    description: `1er Millón de Dólares — Plan ${plan.nombre}`,
    redirectionUrl: new URL("/pago/resultado", request.url).toString(),
    customerData: JSON.stringify({ email: email ?? undefined, fullName: nombre || undefined }),
  });
}
