import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import { pruebaGratisVigente, type Scope } from "@/lib/subscription";

export type AdminUserRow = {
  id: string;
  email: string | null;
  createdAt: number;
  acceso: Partial<Record<Scope, string | null>>;
  suscripcionActiva: boolean;
  pruebaGratisVigente: boolean;
  banned: boolean;
};

export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || undefined;

  const client = await clerkClient();
  const { data, totalCount } = await client.users.getUserList({
    query,
    limit: 100,
    orderBy: "-created_at",
  });

  const rows: AdminUserRow[] = data.map((u) => ({
    id: u.id,
    email: u.primaryEmailAddress?.emailAddress ?? null,
    createdAt: u.createdAt,
    acceso:
      (u.publicMetadata?.acceso as
        | Partial<Record<Scope, string | null>>
        | undefined) ?? {},
    // Suscripción paga real (`publicMetadata.suscripcion`, ver
    // subscription.ts) — deja pasar a todo sin importar `acceso`. Se manda
    // aparte para que /admin nunca esconda que una cuenta sigue entrando
    // por esta vía aunque se le hayan quitado los permisos manuales.
    suscripcionActiva: u.publicMetadata?.suscripcion === "activa",
    // Semana gratis automática de la Sala de Trading (ver
    // pruebaGratisVigente() en subscription.ts) — igual que la suscripción
    // real, deja entrar sin que aparezca ninguna fecha en `acceso.sala`, así
    // que también se manda aparte para que no quede escondida en /admin.
    pruebaGratisVigente: pruebaGratisVigente(u.createdAt),
    banned: Boolean(u.banned),
  }));

  return NextResponse.json({ users: rows, totalCount });
}
