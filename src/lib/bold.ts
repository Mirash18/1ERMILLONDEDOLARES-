/**
 * Cobro con el Botón de pagos de Bold (decisión de Alejo, 26 sept. 2026 —
 * ya trabajaba con Bold). Documentación: developers.bold.co.
 *
 * Bold NO cobra solo cada mes (no tiene suscripciones): cada pago es único.
 * Lo automático es lo de este lado: el pago confirmado abre el acceso según
 * el plan (ver `aplicarPlan`) y el acceso vence solo.
 *
 * Flujo:
 *   1. /api/pagos/orden crea la orden (amarrada a la cuenta de Clerk), la
 *      guarda en Redis y firma `{orden}{monto}{moneda}{llave secreta}` con
 *      SHA-256 — con la firma, nadie puede cambiar el monto en el navegador.
 *   2. El navegador abre la pasarela de Bold (BoldCheckout) con esos datos.
 *   3. La orden se confirma por DOS caminos, cualquiera sirve:
 *      - al volver de Bold, /pago/resultado le PREGUNTA a Bold el estado
 *        (no se confía en lo que diga la URL);
 *      - el webhook de Bold (/api/webhooks/bold), firmado.
 *      En modo de pruebas Bold no manda webhooks solo, así que el primero
 *      es el que hace funcionar las pruebas. Si llegan los dos, el plan se
 *      aplica una sola vez (candado en Redis por orden).
 *
 * Llaves (en Vercel, nunca en el código): BOLD_IDENTITY_KEY (la de
 * identidad — es pública, viaja al navegador) y BOLD_SECRET_KEY (la
 * secreta — solo en el servidor). BOLD_PRUEBAS=1 mientras sean las de
 * pruebas (cambia cómo se verifica la firma del webhook).
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { getRedisClient } from "./marketCache";
import { PLANES, type PlanId } from "./planes";
import { calcularAcceso } from "./planesAcceso";

const API_BOLD = "https://payments.api.bold.co/v2/payment-voucher";

// Moneda del cobro. Los precios de lib/planes.ts están en dólares. Ojo: en
// USD Bold solo acepta tarjeta (no PSE ni Nequi) y convierte a pesos con la
// TRM del día.
export const MONEDA_BOLD = "USD";

export function boldConfigurado(): boolean {
  return Boolean(process.env.BOLD_IDENTITY_KEY && process.env.BOLD_SECRET_KEY);
}

/**
 * Monto como lo pide Bold: "sin decimales". Para USD se manda en centavos
 * ($12.59 → "1259"). PENDIENTE DE CONFIRMAR en el modo de pruebas: si la
 * pasarela muestra $1,259 en vez de $12.59, Bold no quiere centavos en USD
 * y hay que cambiar esto (y seguramente los precios).
 */
export function montoBold(plan: PlanId): string {
  const p = PLANES.find((x) => x.id === plan);
  if (!p) throw new Error(`plan desconocido: ${plan}`);
  return String(Math.round(p.precio * 100));
}

export function firmaIntegridad(orderId: string, monto: string, moneda: string): string {
  return createHash("sha256")
    .update(`${orderId}${monto}${moneda}${process.env.BOLD_SECRET_KEY ?? ""}`)
    .digest("hex");
}

// --- Órdenes (Redis) ---

export type Orden = {
  orderId: string;
  userId: string;
  email: string | null;
  plan: PlanId;
  monto: string;
  moneda: string;
  creada: number;
  estado: "pendiente" | "aprobada";
  aprobada?: number;
};

export type PagoRegistrado = {
  orderId: string;
  userId: string;
  email: string | null;
  plan: PlanId;
  monto: string;
  moneda: string;
  fecha: number;
  /** Qué camino confirmó el pago. */
  via: "regreso" | "webhook";
  /** Cómo quedó el acceso después de aplicar el plan (ISO). */
  salaHasta: string | null;
  clasesHasta: string | null;
  pruebas: boolean;
};

const claveOrden = (id: string) => `bold:orden:${id}`;
const KEY_PAGOS = "pagos:lista";

export async function guardarOrden(orden: Orden): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;
  try {
    await redis.set(claveOrden(orden.orderId), orden);
    return true;
  } catch {
    return false;
  }
}

export async function getOrden(orderId: string): Promise<Orden | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    return await redis.get<Orden>(claveOrden(orderId));
  } catch {
    return null;
  }
}

export async function getPagos(limite = 500): Promise<PagoRegistrado[]> {
  const redis = getRedisClient();
  if (!redis) return [];
  try {
    return await redis.lrange<PagoRegistrado>(KEY_PAGOS, 0, limite - 1);
  } catch {
    return [];
  }
}

// --- Estado del pago según Bold ---

export type EstadoBold =
  | "APPROVED"
  | "REJECTED"
  | "FAILED"
  | "VOIDED"
  | "PROCESSING"
  | "PENDING"
  | "NO_TRANSACTION_FOUND"
  | "ERROR";

/** Le pregunta a Bold cómo va el pago de esa orden. */
export async function consultarEstado(orderId: string): Promise<EstadoBold> {
  const key = process.env.BOLD_IDENTITY_KEY;
  if (!key) return "ERROR";
  try {
    const res = await fetch(`${API_BOLD}/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `x-api-key ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return res.status === 404 ? "NO_TRANSACTION_FOUND" : "ERROR";
    const json = (await res.json()) as { payment_status?: string; reference_id?: string };
    if (json.reference_id && json.reference_id !== orderId) return "ERROR";
    return (json.payment_status as EstadoBold) ?? "ERROR";
  } catch {
    return "ERROR";
  }
}

// --- Webhook ---

/**
 * Firma del webhook: HMAC-SHA256 (hex) del cuerpo crudo codificado en
 * base64, con la llave secreta — en modo de pruebas Bold usa llave vacía.
 */
export function firmaWebhookValida(cuerpoCrudo: string, firma: string | null): boolean {
  if (!firma) return false;
  const llave = process.env.BOLD_PRUEBAS === "1" ? "" : (process.env.BOLD_SECRET_KEY ?? "");
  const esperada = createHmac("sha256", llave)
    .update(Buffer.from(cuerpoCrudo, "utf8").toString("base64"))
    .digest("hex");
  const a = Buffer.from(esperada);
  const b = Buffer.from(firma);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Confirma una orden con Bold y, si está aprobada y todavía no se había
 * aplicado, le da el acceso a su dueño. Se puede llamar las veces que sea
 * (regreso de la pasarela, webhook, reintentos de Bold): el candado en
 * Redis hace que se aplique una sola vez.
 */
export async function confirmarOrden(
  orderId: string,
  via: PagoRegistrado["via"]
): Promise<{ estado: EstadoBold; orden: Orden | null }> {
  const orden = await getOrden(orderId);
  if (!orden) return { estado: "ERROR", orden: null };
  if (orden.estado === "aprobada") return { estado: "APPROVED", orden };

  const estado = await consultarEstado(orderId);
  if (estado !== "APPROVED") return { estado, orden };

  const redis = getRedisClient();
  if (!redis) return { estado: "ERROR", orden };
  // Candado: solo el primero que llegue aplica el plan.
  const candado = `bold:aplicada:${orderId}`;
  const gano = await redis.set(candado, "1", { nx: true });
  if (!gano) return { estado: "APPROVED", orden: (await getOrden(orderId)) ?? orden };

  try {
    return await aplicar(orden, via, redis);
  } catch (err) {
    // Si falló a mitad (Clerk o Redis caídos), se suelta el candado para
    // que el próximo intento (Bold reintenta el webhook, o la persona
    // recarga la página de resultado) lo vuelva a aplicar.
    await redis.del(candado).catch(() => {});
    throw err;
  }
}

async function aplicar(
  orden: Orden,
  via: PagoRegistrado["via"],
  redis: NonNullable<ReturnType<typeof getRedisClient>>
): Promise<{ estado: EstadoBold; orden: Orden }> {
  const orderId = orden.orderId;
  const ahora = Date.now();
  const client = await clerkClient();
  const user = await client.users.getUser(orden.userId);
  const accesoPrevio = (user.publicMetadata?.acceso ?? {}) as Record<string, unknown>;
  const rachaPrevia =
    (user.publicMetadata?.premium as { racha?: number } | undefined)?.racha ?? 0;
  const { acceso, racha } = calcularAcceso(orden.plan, accesoPrevio, rachaPrevia, ahora);

  await client.users.updateUserMetadata(orden.userId, {
    publicMetadata: { acceso, premium: { racha } },
  });

  const aprobada: Orden = { ...orden, estado: "aprobada", aprobada: ahora };
  await redis.set(claveOrden(orderId), aprobada);
  const pago: PagoRegistrado = {
    orderId,
    userId: orden.userId,
    email: orden.email,
    plan: orden.plan,
    monto: orden.monto,
    moneda: orden.moneda,
    fecha: ahora,
    via,
    salaHasta: typeof acceso.sala === "string" ? acceso.sala : null,
    clasesHasta: typeof acceso.clases === "string" ? acceso.clases : null,
    pruebas: process.env.BOLD_PRUEBAS === "1",
  };
  await redis.lpush(KEY_PAGOS, pago);

  return { estado: "APPROVED", orden: aprobada };
}
