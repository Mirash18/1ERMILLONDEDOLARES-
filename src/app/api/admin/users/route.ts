import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import type { Scope } from "@/lib/subscription";

export type AdminUserRow = {
  id: string;
  email: string | null;
  createdAt: number;
  acceso: Partial<Record<Scope, string | null>>;
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
    banned: Boolean(u.banned),
  }));

  return NextResponse.json({ users: rows, totalCount });
}
