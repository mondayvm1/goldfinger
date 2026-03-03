/**
 * Engine API client — calls the Python FastAPI backend.
 *
 * All requests are authenticated with ENGINE_API_KEY.
 * User credentials are sent encrypted per-request.
 */

const ENGINE_URL = process.env.ENGINE_URL || "http://localhost:8050";
const ENGINE_API_KEY = process.env.ENGINE_API_KEY || "";

interface EngineRequestOptions {
  path: string;
  method?: "GET" | "POST";
  body?: Record<string, unknown> | object;
}

async function engineFetch<T = unknown>({
  path,
  method = "POST",
  body,
}: EngineRequestOptions): Promise<T> {
  const url = `${ENGINE_URL}${path}`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Engine-Key": ENGINE_API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Engine error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ── Scan ──────────────────────────────────────────────────────

export interface ScanRequest {
  user_id: string;
  api_key_enc: string;
  private_key_enc: string;
  settle?: boolean;
}

export interface Signal {
  id: string;
  asset: string;
  direction: string;
  entry_price: number;
  payout: number;
  size: number;
  time_left: string;
  time_left_mins: number;
  signal_strength: number;
  signal_label: string;
}

export interface ScanResponse {
  signals: Signal[];
  stats: {
    balance: number;
    total_trades: number;
    realized_pnl: number;
    win_rate: number;
    wins: number;
    losses: number;
    open_positions: number;
  };
  scanning: string[];
}

export async function scanSignals(req: ScanRequest): Promise<ScanResponse> {
  return engineFetch<ScanResponse>({
    path: "/api/scan",
    body: {
      user_id: req.user_id,
      api_key_enc: req.api_key_enc,
      private_key_enc: req.private_key_enc,
      settle: req.settle ?? true,
    },
  });
}

// ── Trade ─────────────────────────────────────────────────────

export interface TradeRequest {
  user_id: string;
  api_key_enc: string;
  private_key_enc: string;
  ticker: string;
  side: string;
  price: number;
  count: number;
}

export interface TradeResponse {
  success: boolean;
  order_id?: string;
  status?: string;
  error?: string;
}

export async function executeTrade(req: TradeRequest): Promise<TradeResponse> {
  return engineFetch<TradeResponse>({
    path: "/api/trade",
    body: req,
  });
}

// ── Sync Trades ──────────────────────────────────────────────

export interface SyncTradesRequest {
  user_id: string;
  api_key_enc: string;
  private_key_enc: string;
  trades: {
    id: string;
    order_id: string | null;
    ticker: string;
    side: string;
    price: number;
    count: number;
    fee: number;
    current_status: string;
  }[];
}

export interface TradeUpdate {
  id: string;
  status: string;
  pnl?: number;
  settled_price?: number;
}

export interface SyncTradesResponse {
  updates: TradeUpdate[];
}

export async function syncTrades(req: SyncTradesRequest): Promise<SyncTradesResponse> {
  return engineFetch<SyncTradesResponse>({
    path: "/api/sync-trades",
    body: req,
  });
}
