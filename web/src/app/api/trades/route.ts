/**
 * /api/trades — Fetch the authenticated user's trade history.
 *
 * Returns the last 50 trades, sorted newest-first.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const trades = await prisma.trade.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        ticker: true,
        side: true,
        price: true,
        count: true,
        fee: true,
        pnl: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ trades });
  } catch (error) {
    console.error("Trades fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch trades." },
      { status: 500 }
    );
  }
}
