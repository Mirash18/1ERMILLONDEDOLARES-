import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import type { Scope } from "@/lib/subscription";

const SCOPES: Scope[] = ["introduccion", "sala"];

/**
 * Da o quita acceso manual a una o más secciones (`scopes`) —
 * `publicMetadata.acceso` en Clerk, ver `subscription.ts` — a una lista de
 * usuarios de una sola vez.
 *
 * Body: `{ userIds: string[], scopes: ("introduccion" | "sala")[], days:
 * number | null }` — `days` es cuántos días de acceso a partir de ahora (7,
 * 14, 30...); `null` quita el acceso a esas secciones (borra su fecha en
 * vez de ponerla en el pasado, para no dejar basura en los metadatos).
 * Mandar varias secciones a la vez (o todas, ver "Todas" en
 * AdminUserTable.tsx) es lo normal cuando alguien contrata todo — así no
 * hace falta un viaje de ida y vuelta por sección.
 *
 * `publicMetadata.acceso` guarda una fecha por sección (`{ introduccion:
 * "...", sala: "..." }`). Clerk hace merge profundo de los metadatos: una
 * llave que no se menciona en la actualización se queda tal cual estaba
 * (no desaparece), así que omitirla (con `delete`, por ejemplo) NO la
 * borra — Clerk la repone del valor anterior porque "no dijiste que la
 * tocara". Por eso aquí se lee primero el usuario (para no pisar otras
 * secciones que no vinieron en este pedido) y, para quitar acceso, se
 * manda esa llave con valor `null` explícito — la única forma en que
 * Clerk realmente la borra.
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const userIds: string[] = Array.isArray(body?.userIds)
    ? body.userIds.filter((id: unknown) => typeof id === "string")
    : [];
  const scopes: Scope[] = Array.isArray(body?.scopes)
    ? body.scopes.filter((s: unknown) => SCOPES.includes(s as Scope))
    : [];
  const days = typeof body?.days === "number" ? body.days : null;

  if (userIds.length === 0 || scopes.length === 0) {
    return NextResponse.json({ error: "faltan datos" }, { status: 400 });
  }

  const hasta =
    days !== null
      ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const client = await clerkClient();
  const resultados = await Promise.all(
    userIds.map(async (userId) => {
      try {
        const user = await client.users.getUser(userId);
        const acceso: Partial<Record<Scope, string | null>> = {
          ...(user.publicMetadata?.acceso as
            | Partial<Record<Scope, string | null>>
            | undefined),
        };
        for (const scope of scopes) {
          acceso[scope] = hasta;
        }

        await client.users.updateUserMetadata(userId, {
          publicMetadata: { acceso },
        });
        return { userId, ok: true };
      } catch (err) {
        return {
          userId,
          ok: false,
          error: err instanceof Error ? err.message : "error desconocido",
        };
      }
    })
  );

  return NextResponse.json({ hasta, scopes, resultados });
}
