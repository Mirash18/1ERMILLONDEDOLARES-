import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import type { Scope } from "@/lib/subscription";

const SCOPES: Scope[] = ["introduccion", "sala"];

/**
 * Da o quita acceso manual a UNA sección (`scope`) — `publicMetadata.acceso`
 * en Clerk, ver `subscription.ts` — a una lista de usuarios de una sola vez.
 *
 * Body: `{ userIds: string[], scope: "introduccion" | "sala", days: number
 * | null }` — `days` es cuántos días de acceso a partir de ahora (7, 14,
 * 30...); `null` quita el acceso a esa sección (borra su fecha en vez de
 * ponerla en el pasado, para no dejar basura en los metadatos).
 *
 * `publicMetadata.acceso` guarda una fecha por sección (`{ introduccion:
 * "...", sala: "..." }`). Clerk reemplaza ese objeto entero en cada
 * actualización (no hace merge profundo) — por eso aquí se lee primero el
 * usuario, se cambia solo la sección pedida, y se manda el objeto completo
 * de vuelta, para no borrar sin querer el acceso ya dado a la otra sección.
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const userIds: string[] = Array.isArray(body?.userIds)
    ? body.userIds.filter((id: unknown) => typeof id === "string")
    : [];
  const scope: Scope | null = SCOPES.includes(body?.scope) ? body.scope : null;
  const days = typeof body?.days === "number" ? body.days : null;

  if (userIds.length === 0 || !scope) {
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
        const acceso: Partial<Record<Scope, string>> = {
          ...(user.publicMetadata?.acceso as
            | Partial<Record<Scope, string>>
            | undefined),
        };
        if (hasta === null) delete acceso[scope];
        else acceso[scope] = hasta;

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

  return NextResponse.json({ hasta, scope, resultados });
}
