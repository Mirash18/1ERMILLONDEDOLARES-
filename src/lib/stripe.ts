/**
 * Cliente de Stripe. Corre SIEMPRE en el servidor — la llave secreta nunca
 * llega al navegador. Ver docs/ARQUITECTURA.md → "Cómo va a fluir el acceso
 * pagado".
 *
 * Mismo criterio que el resto del proyecto: sin la llave puesta, `getStripe()`
 * devuelve `null` y quien la llama debe fallar hacia el lado seguro (no
 * dejar pagar, no dejar entrar) en vez de reventar.
 */

import Stripe from "stripe";

let client: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (client !== undefined) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  client = key ? new Stripe(key) : null;
  return client;
}
