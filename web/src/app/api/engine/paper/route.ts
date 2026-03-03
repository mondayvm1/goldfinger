import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const ENGINE_URL = process.env.ENGINE_URL || "http://localhost:8080";
const ENGINE_API_KEY = process.env.ENGINE_API_KEY || "";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const res = await fetch(`${ENGINE_URL}/api/paper`, {
      headers: { "Authorization": `Bearer ${ENGINE_API_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Engine returned ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Engine unreachable" },
      { status: 502 }
    );
  }
}

// POST /api/engine/paper?action=reset
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const action = req.nextUrl.searchParams.get("action");
  const body = await req.json().catch(() => ({}));

  const endpoint = action === "reset" ? "/api/paper/reset" : "/api/paper";

  try {
    const res = await fetch(`${ENGINE_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${ENGINE_API_KEY}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Engine returned ${res.status}`);
    return NextResponse.json(await res.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Engine unreachable" },
      { status: 502 }
    );
  }
}
