import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";

/**
 * Da o quita acceso manual (`accesoManualHasta` en los metadatos públicos
 * de Clerk, ver `subscription.ts`) a una lista de usuarios de una sola vez.
 *
 * Body: `{ userIds: string[], days: number | null }` — `days` es cuántos
 * días de acceso a partir de ahora (7, 14, 30...); `null` quita el acceso
 * (borra la fecha en vez de ponerla en el pasado, para no dejar basura en
 * los metadatos).
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const userIds: string[] = Array.isArray(body?.userIds)
    ? body.userIds.filter((id: unknown) => typeof id === "string")
    : [];
  const days = typeof body?.days === "number" ? body.days : null;

  if (userIds.length === 0) {
    return NextResponse.json({ error: "sin usuarios" }, { status: 400 });
  }

  const hasta =
    days !== null
      ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const client = await clerkClient();
  const resultados = await Promise.all(
    userIds.map(async (userId) => {
      try {
        await client.users.updateUserMetadata(userId, {
          publicMetadata: { accesoManualHasta: hasta },
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

  return NextResponse.json({ hasta, resultados });
}
