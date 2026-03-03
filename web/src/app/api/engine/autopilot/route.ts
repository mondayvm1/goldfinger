import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const ENGINE_URL = process.env.ENGINE_URL || "http://localhost:8080";
const ENGINE_API_KEY = process.env.ENGINE_API_KEY || "";

// POST /api/engine/autopilot?action=start|stop|kill
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const action = req.nextUrl.searchParams.get("action");
  if (!action || !["start", "stop", "kill"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    const res = await fetch(`${ENGINE_URL}/api/autopilot/${action}`, {
      method: "POST",
      headers: { "X-API-Key": ENGINE_API_KEY },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Engine returned ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Engine unreachable" },
      { status: 502 }
    );
  }
}

// GET /api/engine/autopilot — status check
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const res = await fetch(`${ENGINE_URL}/api/status`, {
      headers: { "X-API-Key": ENGINE_API_KEY },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Engine returned ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ running: false, error: "Engine unreachable" });
  }
}
