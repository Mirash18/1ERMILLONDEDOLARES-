import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getStripe } from "@/lib/stripe";
import { paymentsConfigured } from "@/lib/subscription";

/**
 * Crea una sesión de Stripe Checkout para la suscripción de $25/mes y
 * devuelve su URL — el navegador solo redirige ahí, nunca ve ninguna llave.
 *
 * `client_reference_id` guarda el id de usuario de Clerk: es lo único que
 * le permite al webhook (`/api/webhooks/stripe`) saber a quién marcarle
 * `suscripcion: "activa"` cuando Stripe confirme el pago.
 */
export async function POST(request: Request) {
  if (!paymentsConfigured()) {
    return NextResponse.json(
      { error: "Los pagos todavía no están disponibles." },
      { status: 503 }
    );
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Inicia sesión para suscribirte." },
      { status: 401 }
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Los pagos todavía no están disponibles." },
      { status: 503 }
    );
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;

  const origin = new URL(request.url).origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      // `client_reference_id` sirve para el evento `checkout.session.completed`.
      // `subscription_data.metadata` deja el mismo dato pegado a la propia
      // suscripción de Stripe, para que los eventos que lleguen después
      // (renovación, cancelación) también sepan a qué usuario de Clerk
      // corresponden sin tener que ir a buscar el cliente aparte.
      client_reference_id: userId,
      subscription_data: { metadata: { clerkUserId: userId } },
      customer_email: email,
      success_url: `${origin}/suscripcion?pago=exitoso`,
      cancel_url: `${origin}/suscripcion?pago=cancelado`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe no devolvió una URL de pago." },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "error desconocido";
    return NextResponse.json(
      { error: `No se pudo crear la sesión de pago: ${message}` },
      { status: 502 }
    );
  }
}
