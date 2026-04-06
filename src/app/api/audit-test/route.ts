import { prisma } from "@/lib/db/client";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const count = await prisma.menuItem.count({
      where: { archivedAt: null, source: { not: "backfill" } },
    });
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    console.error("[audit-test] Error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
