/**
 * Puerta de acceso al contenido de pago.
 *
 * Esta es la única pieza que decide si alguien puede ver el universo pagado
 * (S&P 500 completo, Nasdaq, clases, herramientas). Todo lo que se cobre debe
 * pasar por aquí, y siempre EN EL SERVIDOR: nunca se confía en lo que diga el
 * navegador sobre si el usuario pagó o no.
 *
 * Cómo va a quedar montado (ver docs/ARQUITECTURA.md):
 *
 *   Clerk  → quién eres (registro, login, contraseña, entrar con Google).
 *   Stripe → si estás al día con el pago.
 *
 * Cuando Stripe confirma o cancela un pago, avisa por webhook y ese aviso
 * guarda el estado en los metadatos del propio usuario de Clerk. Así no hace
 * falta una base de datos aparte: Clerk guarda quién eres y tu estado de
 * suscripción, y Stripe guarda el historial de cobros.
 *
 * Mientras las llaves no estén configuradas en Vercel, `getAccess()` responde
 * "sin-configurar" y no deja pasar a nadie. Es a propósito: si algún día las
 * llaves desaparecen o se escriben mal, el sitio se cierra en vez de abrirse.
 * Fallar hacia el lado seguro.
 */

export type SubscriptionStatus =
  | "activa" // tiene cuenta y la suscripción está al día
  | "sin-suscripcion" // tiene cuenta pero no ha pagado, o se le venció
  | "sin-cuenta" // visitante sin registrar
  | "sin-configurar"; // todavía no se han puesto las llaves en el servidor

export type Access = {
  status: SubscriptionStatus;
  /** Solo es true cuando hay cuenta Y suscripción al día. */
  allowed: boolean;
};

/** Mensaje para mostrarle al visitante según por qué no pudo entrar. */
export const ACCESS_MESSAGE: Record<SubscriptionStatus, string> = {
  activa: "Suscripción activa.",
  "sin-suscripcion": "Necesitas una suscripción activa para ver esto.",
  "sin-cuenta": "Inicia sesión para ver esto.",
  "sin-configurar": "El acceso por suscripción todavía no está disponible.",
};

/**
 * `true` cuando el servidor tiene configurado el sistema de cuentas. Se mira
 * la llave secreta, no la pública: la pública viaja al navegador y podría
 * estar puesta sin que el servidor esté listo.
 */
export function accountsConfigured(): boolean {
  return Boolean(process.env.CLERK_SECRET_KEY);
}

/**
 * Estado de acceso de quien está haciendo la petición.
 *
 * Es `async` a propósito aunque hoy no espere nada: cuando entre Clerk sí va
 * a consultar su servidor, y así el cambio no obliga a tocar a quien la llama.
 */
export async function getAccess(): Promise<Access> {
  if (!accountsConfigured()) {
    return { status: "sin-configurar", allowed: false };
  }

  // A partir de aquí entra Clerk, en cuanto estén las llaves en Vercel:
  //
  //   const { userId, sessionClaims } = await auth();
  //   if (!userId) return { status: "sin-cuenta", allowed: false };
  //   const activa = sessionClaims?.metadata?.suscripcion === "activa";
  //   return activa
  //     ? { status: "activa", allowed: true }
  //     : { status: "sin-suscripcion", allowed: false };
  //
  // Hasta entonces no se deja pasar a nadie.
  return { status: "sin-cuenta", allowed: false };
}
