/**
 * /api/trade — Proxy trade execution to Python engine.
 *
 * Flow: Auth check → lookup keys → forward to engine → log trade in DB.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { executeTrade } from "@/lib/engine";

export async function POST(req: Request) {
  try {
    // 1. Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // 2. Look up encrypted API keys
    const keys = await prisma.userApiKey.findUnique({
      where: { userId_exchange: { userId, exchange: "kalshi" } },
    });

    if (!keys) {
      return NextResponse.json(
        { error: "No API keys configured." },
        { status: 400 }
      );
    }

    // 3. Parse trade request
    const body = await req.json();
    const { ticker, side, price, count } = body;

    if (!ticker || !side || !price || !count) {
      return NextResponse.json(
        { error: "Missing required fields: ticker, side, price, count" },
        { status: 400 }
      );
    }

    // 4. Execute via engine
    const result = await executeTrade({
      user_id: userId,
      api_key_enc: keys.apiKeyEnc,
      private_key_enc: keys.privateKeyEnc,
      ticker,
      side,
      price: parseFloat(price),
      count: parseInt(count),
    });

    // 5. Log trade in our DB
    if (result.success) {
      await prisma.trade.create({
        data: {
          userId,
          orderId: result.order_id || null,
          ticker,
          side,
          price: parseFloat(price),
          count: parseInt(count),
          fee: 0, // Engine calculates actual fee
          status: result.status || "pending",
        },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Trade proxy error:", error);
    return NextResponse.json(
      { error: "Trade failed. Please try again." },
      { status: 500 }
    );
  }
}
