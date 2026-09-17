import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";

export type AdminUserRow = {
  id: string;
  email: string | null;
  createdAt: number;
  accesoManualHasta: string | null;
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
    accesoManualHasta:
      typeof u.publicMetadata?.accesoManualHasta === "string"
        ? u.publicMetadata.accesoManualHasta
        : null,
  }));

  return NextResponse.json({ users: rows, totalCount });
}
