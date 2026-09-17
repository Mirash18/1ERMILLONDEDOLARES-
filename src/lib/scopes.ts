/**
 * Secciones del sitio que se pueden habilitar por separado, a mano, desde
 * /admin — ver `subscription.ts`. Vive en su propio archivo (sin nada de
 * Clerk) porque tanto código de servidor (`subscription.ts`) como
 * componentes de cliente (`AdminUserTable.tsx`) necesitan esta lista, y
 * `subscription.ts` importa `@clerk/nextjs/server`, que no se puede meter
 * en un bundle de cliente.
 */
export type Scope = "introduccion" | "sala";

export const SCOPE_LABELS: Record<Scope, string> = {
  introduccion: "Introducción",
  sala: "Sala de Trading",
};
