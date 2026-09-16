import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getWatchlist, setWatchlist } from "@/lib/watchlist";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ symbols: [] });
  }
  return NextResponse.json({ symbols: await getWatchlist(userId) });
}

export async function PUT(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "inicia sesión" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const symbols = Array.isArray(body?.symbols)
    ? body.symbols.filter((s: unknown) => typeof s === "string")
    : [];

  const saved = await setWatchlist(userId, symbols);
  return NextResponse.json({ symbols: saved });
}
