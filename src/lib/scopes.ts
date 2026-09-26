/**
 * Secciones del sitio que se pueden habilitar por separado, a mano, desde
 * /admin — ver `subscription.ts`. Vive en su propio archivo (sin nada de
 * Clerk) porque tanto código de servidor (`subscription.ts`) como
 * componentes de cliente (`AdminUserTable.tsx`) necesitan esta lista, y
 * `subscription.ts` importa `@clerk/nextjs/server`, que no se puede meter
 * en un bundle de cliente.
 */
export type Scope = "introduccion" | "sala" | "clases";

export const SCOPE_LABELS: Record<Scope, string> = {
  introduccion: "Introducción",
  sala: "Sala de Trading",
  // Clases en vivo por Zoom (26 sept. 2026) — ver src/app/clases.
  clases: "Clases con el profesor Miguel",
};

export const SCOPES = Object.keys(SCOPE_LABELS) as Scope[];

/**
 * Valor especial que guarda "Eliminar acceso" en `publicMetadata.acceso`
 * (ver /api/admin/access) para esa sección. No es lo mismo que no haber
 * dado nunca acceso: bloquea también cualquier forma automática de entrar
 * a esa sección (como la semana gratis de la Sala de Trading, ver
 * `pruebaGratisVigente()` en subscription.ts) — así "Eliminar acceso" es
 * de verdad definitivo, sin importar qué otra puerta automática exista o
 * se agregue después.
 */
export const ACCESO_BLOQUEADO = "bloqueado";
