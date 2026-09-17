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

import { auth, currentUser } from "@clerk/nextjs/server";
import type { Scope } from "@/lib/scopes";

export type { Scope } from "@/lib/scopes";

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
 * `true` cuando además del login (Clerk) también está listo el cobro
 * (Stripe). Son dos interruptores separados a propósito: Clerk puede estar
 * configurado y funcionando (la gente ya puede crear cuenta e iniciar
 * sesión) mientras Stripe sigue pendiente — en ese caso se deja entrar, pero
 * el botón de suscripción se mantiene desactivado porque cobrar todavía no
 * funciona.
 */
export function paymentsConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.STRIPE_PRICE_ID
  );
}

// Las secciones que se pueden habilitar por separado (Scope) y sus
// nombres para mostrar viven en `scopes.ts`, no acá — ese archivo no
// importa nada de Clerk, así que también lo puede usar un componente de
// cliente como AdminUserTable.tsx sin arrastrar código de servidor al
// bundle del navegador.
type AccesoManual = Partial<Record<Scope, string>>;

function accesoManualVigente(
  acceso: AccesoManual | undefined,
  scope: Scope
): boolean {
  const hasta = acceso?.[scope];
  return typeof hasta === "string" && new Date(hasta).getTime() > Date.now();
}

/**
 * Estado de acceso de quien está haciendo la petición.
 *
 * Sin `scope`, solo cuenta la suscripción paga real (`suscripcion:
 * "activa"`) — así `/suscripcion` puede seguir preguntando "¿ya pagó?" sin
 * que un acceso manual dado para una sección puntual haga parecer que la
 * membresía completa está activa.
 *
 * Con `scope`, además de la suscripción paga también cuenta el acceso
 * manual dado a esa sección específica desde /admin (ver
 * `publicMetadata.acceso` — src/app/api/admin/access/route.ts). Pasada la
 * fecha límite, vuelve a comportarse como si nunca se hubiera dado.
 *
 * Es `async` a propósito aunque hoy no espere nada más que Clerk: así el
 * día que entre otro proveedor de pagos no hay que tocar a quien la llama.
 */
export async function getAccess(scope?: Scope): Promise<Access> {
  if (!accountsConfigured()) {
    return { status: "sin-configurar", allowed: false };
  }

  const { userId } = await auth();
  if (!userId) {
    return { status: "sin-cuenta", allowed: false };
  }

  // Se consulta el usuario completo (en vez de leer `sessionClaims`) porque
  // eso funciona con la configuración por defecto de Clerk, sin tener que ir
  // al dashboard a personalizar el token de sesión para que incluya
  // `publicMetadata`. Cuando MercadoPago confirme un pago (pendiente), su
  // webhook escribe `suscripcion: "activa"` en los metadatos públicos de
  // este mismo usuario — hasta entonces nadie tiene suscripción activa.
  const user = await currentUser();
  const activaPorPago = user?.publicMetadata?.suscripcion === "activa";
  const acceso = user?.publicMetadata?.acceso as AccesoManual | undefined;
  const activaManualmente = scope ? accesoManualVigente(acceso, scope) : false;

  return activaPorPago || activaManualmente
    ? { status: "activa", allowed: true }
    : { status: "sin-suscripcion", allowed: false };
}

/**
 * Igual que `getAccess()`, pero para lo que deciden las rutas de datos
 * (`/api/candles`, `/api/premarket`, `/api/earnings`, `/api/universe`,
 * `/api/quotes`) sobre si dejan pasar un símbolo del universo pagado.
 *
 * `scope === "sala"` es la Sala de Trading — exige suscripción activa o
 * acceso manual a "sala". Cualquier otro contexto (portada, dentro de
 * /introduccion) exige suscripción activa real, sin acceso manual de por
 * medio: ver el símbolo ahí no es lo mismo que poder entrar a la página.
 */
export async function getSymbolAccess(scope: string | null): Promise<Access> {
  return scope === "sala" ? getAccess("sala") : getAccess();
}

export async function hasSymbolAccess(scope: string | null): Promise<boolean> {
  return (await getSymbolAccess(scope)).allowed;
}
