/**
 * /api/scan — Proxy to Python engine.
 *
 * Flow: Auth check → lookup user's encrypted keys → forward to engine.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scanSignals } from "@/lib/engine";

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
        { error: "No API keys configured. Go to Settings to connect your Kalshi account." },
        { status: 400 }
      );
    }

    // 3. Parse request body
    const body = await req.json().catch(() => ({}));
    const settle = body.settle !== false;

    // 4. Forward to engine (encrypted keys — engine decrypts in memory)
    const result = await scanSignals({
      user_id: userId,
      api_key_enc: keys.apiKeyEnc,
      private_key_enc: keys.privateKeyEnc,
      settle,
    });

    // 5. Update scan count
    await prisma.user.update({
      where: { id: userId },
      data: {
        scansToday: { increment: 1 },
        lastScanAt: new Date(),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Scan proxy error:", error);
    return NextResponse.json(
      { error: "Scan failed. Please try again." },
      { status: 500 }
    );
  }
}
