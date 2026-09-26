import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import { ACCESO_BLOQUEADO, SCOPES } from "@/lib/scopes";
import type { Scope } from "@/lib/subscription";

/**
 * Da o quita acceso manual a una o más secciones (`scopes`) —
 * `publicMetadata.acceso` en Clerk, ver `subscription.ts` — a una lista de
 * usuarios de una sola vez.
 *
 * Body: `{ userIds: string[], scopes: Scope[] (ver SCOPES), days:
 * number | null }` — `days` es cuántos días de acceso a partir de ahora (7,
 * 14, 30...); `null` es "Eliminar acceso": guarda `ACCESO_BLOQUEADO` en vez
 * de una fecha, para que quede bloqueada de verdad — incluyendo cualquier
 * forma automática de entrar (como la semana gratis de la Sala de Trading,
 * ver pruebaGratisVigente() en subscription.ts), no solo el permiso manual
 * que se le hubiera dado antes. Mandar varias secciones a la vez (o todas,
 * ver "Todas" en AdminUserTable.tsx) es lo normal cuando alguien contrata
 * todo — así no hace falta un viaje de ida y vuelta por sección.
 *
 * `publicMetadata.acceso` guarda un valor por sección (`{ introduccion:
 * "...", sala: "..." }`). Clerk hace merge profundo de los metadatos: una
 * llave que no se menciona en la actualización se queda tal cual estaba
 * (no desaparece), así que omitirla (con `delete`, por ejemplo) NO la
 * cambia — Clerk repone el valor anterior porque "no dijiste que la
 * tocara". Por eso aquí se lee primero el usuario (para no pisar otras
 * secciones que no vinieron en este pedido) y siempre se manda un valor
 * explícito para las secciones pedidas.
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
      : ACCESO_BLOQUEADO;

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
