import { NextResponse } from "next/server";
import { confirmarOrden, firmaWebhookValida } from "@/lib/bold";

/**
 * Webhook de Bold (se registra en el panel de Bold → Integraciones →
 * Webhooks). Ver lib/bold.ts.
 *
 * Bold exige responder 200 en menos de 2 segundos y reintenta si no (15 min,
 * 1 h, 4 h, 8 h, 24 h), y puede mandar el mismo aviso más de una vez —
 * `confirmarOrden` aplica el plan una sola vez. Además, no se confía en el
 * contenido del aviso: `confirmarOrden` le vuelve a preguntar el estado a
 * Bold antes de dar acceso.
 */
export async function POST(request: Request) {
  const cuerpo = await request.text();
  if (!firmaWebhookValida(cuerpo, request.headers.get("x-bold-signature"))) {
    return NextResponse.json({ error: "firma inválida" }, { status: 401 });
  }

  let evento: { type?: string; data?: { metadata?: { reference?: string } } };
  try {
    evento = JSON.parse(cuerpo);
  } catch {
    return NextResponse.json({ error: "cuerpo inválido" }, { status: 400 });
  }

  const orderId = evento.data?.metadata?.reference;
  if (evento.type === "SALE_APPROVED" && orderId) {
    try {
      await confirmarOrden(orderId, "webhook");
    } catch {
      // 500 → Bold reintenta más tarde (el candado se soltó en confirmarOrden).
      return NextResponse.json({ error: "no se pudo aplicar" }, { status: 500 });
    }
  }

  // Los demás eventos (rechazada, anulada) no cambian el acceso.
  return NextResponse.json({ ok: true });
}
