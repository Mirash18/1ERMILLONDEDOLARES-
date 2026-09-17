/**
 * Panel de administración (`/admin`) — quién puede entrar, y qué puede
 * hacer ahí: ver la lista de gente registrada y darle o quitarle acceso
 * manual, sección por sección (ver `publicMetadata.acceso` en
 * `subscription.ts`).
 *
 * La lista de correos admin vive en una variable de entorno
 * (`ADMIN_EMAILS`, separados por coma) — nunca hardcodeada en el código,
 * para poder cambiarla sin tocar ni desplegar nada.
 */

import { currentUser } from "@clerk/nextjs/server";

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * `true` si quien está haciendo la petición es uno de los correos admin.
 * Falla hacia el lado seguro: sin `ADMIN_EMAILS` configurado, nadie es
 * admin — nunca al revés.
 */
export async function isAdmin(): Promise<boolean> {
  const emails = adminEmails();
  if (emails.length === 0) return false;

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  return Boolean(email && emails.includes(email));
}
