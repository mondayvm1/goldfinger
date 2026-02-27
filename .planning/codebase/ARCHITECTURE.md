# Architecture

**Analysis Date:** 2026-02-26

## Pattern Overview

**Overall:** Dual-layer microservice pattern with encrypted credential passing.

**Key Characteristics:**
- **Stateless engine** — Python FastAPI backend holds no user data; all state owned by Next.js web layer
- **Encryption-in-flight** — API credentials transmitted encrypted (Fernet) from web to engine, decrypted in-memory on engine only
- **Firewall pattern** — Engine output sanitized before reaching browser (strategy internals never exposed)
- **Multi-user capable** — Web layer multiplexes single engine instance across authenticated users
- **Real-time signal detection** — Browser polls engine every 45 seconds when auto-scan enabled

## Layers

**Web Layer (Next.js 16 / React 19 / TypeScript):**
- Purpose: User authentication, credential management, dashboard UI, trade management, API proxying
- Location: `web/src/`
- Contains: Server components (routes, middleware), client components (dashboard), utility libraries (auth, encryption, engine client)
- Depends on: NextAuth, Prisma, Neon Postgres, Fernet crypto
- Used by: Browser clients (end users)
- Responsibilities: Google OAuth flow, encrypted key storage/retrieval, trade history, dashboard state

**API Proxy Layer (Next.js server routes):**
- Purpose: Enforce authentication, lookup credentials, forward requests to engine with encryption, log results to DB
- Location: `web/src/app/api/`
- Routes:
  - `POST /api/scan` — Fetch encrypted keys, call engine, update scan counter, return signals
  - `POST /api/trade` — Execute trade via engine, log result to Trade table
  - `DELETE /api/keys` or `POST /api/keys` — Encrypt and store/remove credentials
  - `GET /api/trades` — Fetch user's trade history from DB
  - `POST /api/sync` — Check Kalshi for trade settlements, update PnL
- Pattern: Guard → lookup → forward → respond
- Depends on: Auth middleware, Prisma, engine client library

**Engine Layer (Python FastAPI):**
- Purpose: Signal detection, trade execution, market data fetching, PnL calculation
- Location: `engine/src/`
- Supports two modes:
  1. **Standalone** — reads credentials from .env (single-user/admin mode for development)
  2. **Multi-user** — receives encrypted credentials per-request, validates via ENGINE_API_KEY header
- Contains: Strategy engine, exchange clients, scanner orchestration, firewall
- Depends on: Kalshi API, Polymarket CLOB, httpx, scipy (Black-Scholes)
- Used by: Web API proxy
- Responsibilities: Market analysis, signal generation, trade placement, settlement checks

**Strategy Engine (Python core):**
- Purpose: Black-Scholes pricing, signal confidence scoring, opportunity detection
- Location: `engine/src/core/`
- Modules:
  - `strategy.py` — Signal detection (v3 calibration), Black-Scholes fair value, Kelly sizing
  - `matcher.py` — Cross-market price comparison (Kalshi ↔ Polymarket)
  - `arbitrage.py` — Spread detection
  - `executor.py` — Trade placement logic

**Data Layer (Neon Postgres via Prisma):**
- Purpose: Persistent user state, trade records, API key storage
- Location: `web/prisma/schema.prisma`
- Models:
  - `User` — NextAuth user record (id, email, tier, scan counters)
  - `UserApiKey` — Encrypted credentials per user (apiKeyEnc, privateKeyEnc)
  - `Trade` — Execution record with settlement state (status, pnl)
  - NextAuth models: Account, Session, VerificationToken

## Data Flow

**Scan Flow:**
1. Browser user clicks "Scan Now" button
2. `web/src/app/(dashboard)/dashboard/page.tsx` → `POST /api/scan`
3. `web/src/app/api/scan/route.ts` → Auth check → lookup encrypted keys from DB → call engine
4. Engine (`engine/src/server/routes/api.py::scan_multiuser`) → decrypt credentials in-memory → fetch markets → run strategy
5. Strategy returns raw recommendations with internals (fair_value, confidence, Greeks)
6. Firewall (`engine/src/server/firewall.py`) → strips all internals → returns sanitized signals (stars, labels, asset, direction, price)
7. Web layer updates browser state, returns to user

**Trade Execution Flow:**
1. User clicks trade button on a signal card
2. `SignalCard.tsx` → `POST /api/trade` with (ticker, side, price, count)
3. `web/src/app/api/trade/route.ts` → Auth check → lookup keys → call engine
4. Engine (`engine/src/server/routes/api.py::trade_multiuser`) → decrypt → place order on Kalshi → return order_id
5. Web stores trade in DB with status="pending"
6. Browser refreshes dashboard after 2 seconds
7. Browser calls `GET /api/trades` to refresh history
8. Auto-sync runs every 45 seconds → checks Kalshi for settlement → updates pnl

**Settlement Sync Flow:**
1. Dashboard page or auto-sync timer triggers `POST /api/sync`
2. `web/src/app/api/sync/route.ts` → fetch pending trades from DB → call engine sync
3. Engine (`engine/src/server/scanner.py::sync_trades_for_user`) → for each trade, check market status
4. If market settled (result="yes"|"no"), calculate PnL = (1.0 - cost) if won else -cost
5. Return updates with status, pnl, settled_price
6. Web applies updates to Trade records

**State Management:**
- **Auth state** — NextAuth JWT token (persisted in cookies)
- **Encrypted keys** — Stored in Neon, retrieved only when needed (not cached client-side)
- **Scan results** — Held in browser useState, cleared on new scan
- **Trade history** — Fetched from DB on demand, cached in browser useState
- **Session state** — Owned by Web layer; engine is stateless

## Key Abstractions

**EngineClient (web/src/lib/engine.ts):**
- Purpose: Encapsulate all engine HTTP calls
- Pattern: Type-safe request/response with Pydantic schemas
- Examples: `scanSignals()`, `executeTrade()`, `syncTrades()`
- All requests authenticated with `X-Engine-Key` header

**Fernet Encryption (shared between web and engine):**
- Purpose: Encrypt API credentials in-flight without storage in plaintext
- Web location: `web/src/lib/crypto.ts` (encrypt/decrypt functions)
- Engine location: `engine/src/crypto.py` (decrypt only)
- Key: `FERNET_KEY` environment variable (shared)
- Flow: Web encrypts → transmits → engine decrypts in-memory → discards after request

**Firewall (engine/src/server/firewall.py):**
- Purpose: Strip strategy internals before returning to user
- Pattern: `sanitize_recommendation()` (one signal), `sanitize_stats()` (aggregate stats)
- Redacted: fair_value, ema, Greeks, Kelly fraction, confidence raw value, edge, reason
- Preserved: ticker, asset, direction, price, payout, size, minutes_left
- Maps raw confidence (0-100) to user-facing stars (1-5) and labels

**Prisma ORM:**
- Purpose: Type-safe database access in Node.js
- Uses: Neon serverless Postgres
- Patterns: Unique constraints on `[userId, exchange]`, cascade delete on User
- Hooks: `postinstall` regenerates types; `build` runs migration

**NextAuth v5:**
- Purpose: OAuth flow + session management
- Provider: Google (OAuth 2.0)
- Adapter: PrismaAdapter (stores sessions/accounts in DB)
- Session strategy: JWT (stateless, client-side verification possible)
- Middleware: `auth as middleware` protects `/dashboard`, `/settings`, `/api/scan`, `/api/trade`, `/api/keys`

## Entry Points

**Web Entry (Browser):**
- Location: `web/src/app/page.tsx`
- Triggers: User navigates to /
- Responsibility: Redirect authenticated users to /dashboard, unauthenticated to LandingPage
- Flow: await auth() → check session.user → redirect() or render LandingPage

**Dashboard Entry (Authenticated Users):**
- Location: `web/src/app/(dashboard)/dashboard/page.tsx`
- Triggers: User clicks "Dashboard" or redirected from login
- Responsibility: Fetch signals on-demand, manage auto-scan toggle, execute trades, display history
- Protected by: `web/src/app/(dashboard)/layout.tsx` (server-side auth check → redirect if not authenticated)

**API Entry (Web ↔ Engine):**
- Location: `web/src/app/api/scan/route.ts`, `trade/route.ts`, etc.
- Triggers: Browser POST requests
- Responsibility: Proxy to engine with authentication, credential lookup, response transformation
- Protected by: `web/src/middleware.ts` (guard listed routes) + individual route auth checks

**Engine Entry (Engine):**
- Location: `engine/src/server/app.py::create_app()`
- Triggers: Server startup
- Responsibility: Build FastAPI app with CORS, ENGINE_API_KEY middleware, mount routes
- Routes: GET/POST `/api/scan`, POST `/api/trade`, POST `/api/sync-trades`, GET `/api/health`
- Protected by: `ENGINE_API_KEY` header middleware (if set)

## Error Handling

**Strategy:** Try-catch with specific error messages, fallback to generic 500 responses on internal errors.

**Patterns:**

**Web API routes:**
```typescript
try {
  // Auth check
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({error: "Unauthorized"}, {status: 401});

  // Business logic
  const result = await someOperation();
  return NextResponse.json(result);
} catch (error) {
  console.error("Operation failed:", error);
  return NextResponse.json({error: "Operation failed. Please try again."}, {status: 500});
}
```

**Engine routes:**
```python
try:
  raw = await run_scan_for_user(...)
  return _build_scan_response(raw)
except Exception as e:
  logger.error(f"Scan failed: {e}", exc_info=True)
  return JSONResponse(
    status_code=500,
    content={"error": "Scan failed. Check server logs."}
  )
```

**Client-side (dashboard):**
- Async operations wrapped in useState(error)
- User feedback via error banner (dismissed by click)
- Duplicate order prevention: 120-second cooldown per ticker tracked in useRef

## Cross-Cutting Concerns

**Logging:**
- Web: Console.error() on critical paths; silent failures on supplementary operations (trade fetch, sync)
- Engine: Python logging at INFO/ERROR levels; sensitive data (credentials) never logged
- Database: Prisma logs queries in development mode only

**Validation:**
- Web: Client-side input validation (non-empty fields) before submission
- API routes: Pydantic BaseModel validation on request payloads
- Middleware: NextAuth session validation; ENGINE_API_KEY header verification

**Authentication:**
- Web: NextAuth v5 + Google OAuth (JWT strategy)
- API: NextAuth middleware + engine API key header
- Engine: ENGINE_API_KEY middleware (only if set; skips on health check)
- Per-request credentials: Fernet-encrypted, decrypted in-memory only

**Rate Limiting:**
- Not explicitly implemented; relies on exchange APIs (Kalshi, Polymarket) for rate limits
- Scan cooldown: Client-side deduplication (120 seconds per ticker)

---

*Architecture analysis: 2026-02-26*
