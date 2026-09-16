import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { clerkClient } from "@clerk/nextjs/server";
import { getStripe } from "@/lib/stripe";

/**
 * Webhook de Stripe — la única forma en que el estado de suscripción cambia
 * de verdad. Ver docs/ARQUITECTURA.md → "Cómo va a fluir el acceso pagado".
 *
 * Nunca se confía en nada que venga del navegador para esto: solo en un
 * evento firmado por Stripe con `STRIPE_WEBHOOK_SECRET`.
 */

async function setSuscripcion(
  clerkUserId: string | null | undefined,
  activa: boolean
) {
  if (!clerkUserId) return;
  const client = await clerkClient();
  await client.users.updateUserMetadata(clerkUserId, {
    publicMetadata: { suscripcion: activa ? "activa" : "cancelada" },
  });
}

export async function POST(request: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // Sin llaves no hay nada que procesar. Se responde 200 (no 503) para que
  // Stripe no reintente para siempre algo que este servidor nunca va a
  // poder verificar mientras falten las llaves.
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ received: false, error: "no configurado" });
  }

  const signature = request.headers.get("stripe-signature");
  // Tiene que ser el cuerpo crudo, sin parsear — la firma de Stripe se
  // calcula sobre los bytes exactos que mandó, no sobre el JSON ya vuelto a
  // serializar.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("falta la firma stripe-signature");
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "firma inválida";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  switch (event.type) {
    // Primer pago confirmado: se activa la suscripción.
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await setSuscripcion(session.client_reference_id, true);
      break;
    }

    // Renovaciones, cambios de plan, pagos fallidos, etc. El estado real de
    // la suscripción en Stripe manda: "active" o "trialing" cuenta como al
    // día, cualquier otra cosa (past_due, unpaid, canceled...) no.
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const activa =
        subscription.status === "active" || subscription.status === "trialing";
      await setSuscripcion(subscription.metadata?.clerkUserId, activa);
      break;
    }

    // Cancelación definitiva.
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await setSuscripcion(subscription.metadata?.clerkUserId, false);
      break;
    }

    default:
      // Cualquier otro evento se ignora a propósito — solo nos importan
      // estos tres para decidir acceso.
      break;
  }

  return NextResponse.json({ received: true });
}
