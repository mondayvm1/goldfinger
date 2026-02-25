/**
 * /api/keys — Manage user's exchange API keys.
 *
 * POST: Save encrypted Kalshi credentials.
 * DELETE: Remove stored credentials.
 * GET: Check if keys are configured (no secrets returned).
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";

// GET — Check if user has keys stored
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const keys = await prisma.userApiKey.findUnique({
      where: {
        userId_exchange: { userId: session.user.id, exchange: "kalshi" },
      },
      select: { id: true, exchange: true, createdAt: true },
    });

    return NextResponse.json({
      connected: !!keys,
      exchange: "kalshi",
      connectedAt: keys?.createdAt || null,
    });
  } catch (error) {
    console.error("Keys check error:", error);
    return NextResponse.json({ error: "Failed to check keys" }, { status: 500 });
  }
}

// POST — Save new API keys (encrypt before storing)
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { apiKey, privateKey } = body;

    if (!apiKey || !privateKey) {
      return NextResponse.json(
        { error: "Both API key and private key (PEM) are required." },
        { status: 400 }
      );
    }

    // Encrypt both values with Fernet
    const apiKeyEnc = encrypt(apiKey);
    const privateKeyEnc = encrypt(privateKey);

    // Upsert — replace existing keys if any
    await prisma.userApiKey.upsert({
      where: {
        userId_exchange: { userId: session.user.id, exchange: "kalshi" },
      },
      create: {
        userId: session.user.id,
        exchange: "kalshi",
        apiKeyEnc,
        privateKeyEnc,
      },
      update: {
        apiKeyEnc,
        privateKeyEnc,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, message: "Keys saved securely." });
  } catch (error) {
    console.error("Keys save error:", error);
    return NextResponse.json({ error: "Failed to save keys" }, { status: 500 });
  }
}

// DELETE — Remove stored keys
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.userApiKey.deleteMany({
      where: { userId: session.user.id, exchange: "kalshi" },
    });

    return NextResponse.json({ success: true, message: "Keys removed." });
  } catch (error) {
    console.error("Keys delete error:", error);
    return NextResponse.json({ error: "Failed to remove keys" }, { status: 500 });
  }
}
