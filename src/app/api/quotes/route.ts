import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/marketData";
import { getAccess } from "@/lib/subscription";
import { FREE_SYMBOLS } from "@/lib/universe";

export async function GET() {
  const [quotes, access] = await Promise.all([
    getQuotes([...FREE_SYMBOLS]),
    getAccess(),
  ]);
  return NextResponse.json({ quotes, allowed: access.allowed });
}
