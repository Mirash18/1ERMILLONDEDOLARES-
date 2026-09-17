import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";

/**
 * Banea o desbanea cuentas de Clerk.
 *
 * Distinto de "quitar acceso" (`/api/admin/access`): quitar acceso solo le
 * cierra a alguien una sección puntual (Introducción o Sala), pero sigue
 * pudiendo entrar con su cuenta. Banear usa el bloqueo nativo de Clerk —
 * cierra sus sesiones activas y le impide volver a iniciar sesión con ese
 * correo, sin importar la sección; para volver a entrar necesitaría otra
 * cuenta. Pensado para gente que retransmite o comparte el contenido
 * pagado (decisión de Alejo, 17 sept. 2026).
 *
 * Body: `{ userIds: string[], banned: boolean }`.
 */
export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const userIds: string[] = Array.isArray(body?.userIds)
    ? body.userIds.filter((id: unknown) => typeof id === "string")
    : [];
  const banned = Boolean(body?.banned);

  if (userIds.length === 0) {
    return NextResponse.json({ error: "sin usuarios" }, { status: 400 });
  }

  // No dejar que un admin se banee a sí mismo sin querer — se quedaría sin
  // forma de entrar a /admin para deshacerlo.
  const { userId: propioId } = await auth();
  if (banned && userIds.includes(propioId ?? "")) {
    return NextResponse.json(
      { error: "no puedes banear tu propia cuenta" },
      { status: 400 }
    );
  }

  const client = await clerkClient();
  const resultados = await Promise.all(
    userIds.map(async (userId) => {
      try {
        if (banned) await client.users.banUser(userId);
        else await client.users.unbanUser(userId);
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

  return NextResponse.json({ banned, resultados });
}
