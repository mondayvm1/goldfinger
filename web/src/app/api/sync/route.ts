/**
 * /api/sync — Sync trade settlements from Kalshi.
 *
 * Sends pending trades to the engine, which checks Kalshi for
 * market results and returns updated PnL/status. Updates are
 * written back to the Prisma DB.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncTrades } from "@/lib/engine";

export async function POST() {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get encrypted API keys
    const keys = await prisma.userApiKey.findUnique({
      where: { userId_exchange: { userId, exchange: "kalshi" } },
    });

    if (!keys) {
      return NextResponse.json({ error: "No API keys" }, { status: 400 });
    }

    // Find pending trades (pnl is null and not cancelled)
    const pendingTrades = await prisma.trade.findMany({
      where: {
        userId,
        pnl: null,
        NOT: { status: "cancelled" },
      },
      select: {
        id: true,
        orderId: true,
        ticker: true,
        side: true,
        price: true,
        count: true,
        fee: true,
        status: true,
      },
    });

    if (pendingTrades.length === 0) {
      return NextResponse.json({ updates: [], synced: 0 });
    }

    // Send to engine for Kalshi settlement check
    const result = await syncTrades({
      user_id: userId,
      api_key_enc: keys.apiKeyEnc,
      private_key_enc: keys.privateKeyEnc,
      trades: pendingTrades.map((t) => ({
        id: t.id,
        order_id: t.orderId,
        ticker: t.ticker,
        side: t.side,
        price: t.price,
        count: t.count,
        fee: t.fee,
        current_status: t.status,
      })),
    });

    // Apply updates to DB
    let synced = 0;
    for (const update of result.updates) {
      const data: Record<string, unknown> = {};
      if (update.status) data.status = update.status;
      if (update.pnl !== undefined) data.pnl = update.pnl;
      if (update.settled_price !== undefined) data.settledPrice = update.settled_price;

      if (Object.keys(data).length > 0) {
        await prisma.trade.update({
          where: { id: update.id },
          data,
        });
        synced++;
      }
    }

    return NextResponse.json({
      updates: result.updates,
      synced,
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "Sync failed." },
      { status: 500 }
    );
  }
}
