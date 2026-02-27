# Codebase Structure

**Analysis Date:** 2026-02-26

## Directory Layout

```
goldfinger/
├── engine/                        # Python FastAPI backend
│   ├── src/
│   │   ├── core/                 # Signal detection & strategy
│   │   ├── exchanges/            # Kalshi & Polymarket clients
│   │   ├── server/               # FastAPI app & routes
│   │   ├── server/routes/        # API endpoint handlers
│   │   ├── static/               # CSS/JS for standalone dashboard
│   │   ├── templates/            # Jinja2 HTML templates
│   │   ├── crypto.py             # Fernet decryption
│   │   ├── models.py             # Pydantic models
│   │   ├── main.py               # CLI entry for arbitrage scanner
│   │   └── hft.py                # HFT mode CLI
│   ├── config/                   # Platform configuration
│   ├── pyproject.toml            # Python dependencies
│   └── .env.example              # Environment template
│
├── web/                           # Next.js 16 / React 19 frontend
│   ├── src/
│   │   ├── app/                  # Next.js app directory
│   │   │   ├── (dashboard)/      # Protected dashboard routes
│   │   │   │   ├── dashboard/    # Signal grid + trading UI
│   │   │   │   └── settings/     # API key management
│   │   │   ├── api/              # Route handlers (proxies to engine)
│   │   │   │   ├── auth/         # NextAuth callback
│   │   │   │   ├── scan/         # Scan signals proxy
│   │   │   │   ├── trade/        # Trade execution proxy
│   │   │   │   ├── keys/         # Credential management
│   │   │   │   ├── trades/       # Trade history fetch
│   │   │   │   └── sync/         # Settlement sync
│   │   │   ├── login/            # Google OAuth login page
│   │   │   ├── page.tsx          # Root landing page
│   │   │   └── layout.tsx        # Root layout wrapper
│   │   ├── components/           # React components
│   │   │   ├── dashboard/        # Dashboard-specific components
│   │   │   │   ├── DashboardShell.tsx     # Layout wrapper (nav, user menu)
│   │   │   │   ├── SignalCard.tsx         # Individual signal display
│   │   │   │   ├── StatsRow.tsx           # Performance metrics
│   │   │   │   ├── PerformanceChart.tsx   # Chart.js component
│   │   │   │   ├── TradeHistory.tsx       # Trade list
│   │   │   │   └── EmptyState.tsx         # No signals state
│   │   │   └── landing/          # Landing page components
│   │   │       └── LandingPage.tsx        # Marketing page
│   │   ├── lib/                  # Utility libraries
│   │   │   ├── auth.ts           # NextAuth config + handlers
│   │   │   ├── engine.ts         # Engine API client
│   │   │   ├── crypto.ts         # Fernet encryption/decryption
│   │   │   └── prisma.ts         # Prisma client singleton
│   │   ├── types/                # TypeScript type definitions
│   │   │   ├── fernet.d.ts       # Fernet npm package types
│   │   │   └── next-auth.d.ts    # NextAuth v5 session extension
│   │   ├── middleware.ts         # NextAuth middleware for route protection
│   │   └── app/globals.css       # Tailwind base styles
│   ├── prisma/
│   │   ├── schema.prisma         # Database schema (Postgres)
│   │   └── migrations/           # Migration history
│   ├── public/                   # Static assets (favicon, etc.)
│   ├── package.json              # npm dependencies
│   ├── tsconfig.json             # TypeScript config
│   ├── next.config.ts            # Next.js config
│   └── tailwind.config.ts        # Tailwind CSS config
│
├── .planning/
│   └── codebase/                 # GSD codebase documentation
│
└── CLAUDE.md                      # Project tracker & context

```

## Directory Purposes

**`engine/`:**
- Purpose: Python FastAPI microservice for signal detection and trade execution
- Contains: Strategy engine, exchange API clients, request handlers, static files for standalone mode
- Key files: `src/server/app.py` (FastAPI factory), `src/core/strategy.py` (signal detection)

**`engine/src/core/`:**
- Purpose: Core trading logic — signal generation, market pricing, arbitrage detection
- Contains: Black-Scholes pricer, strategy signal finder, cross-platform matcher
- Key files: `strategy.py`, `executor.py`, `matcher.py`

**`engine/src/exchanges/`:**
- Purpose: Exchange API clients
- Contains: Kalshi (CBOT options), Polymarket (CLOB prediction markets)
- Pattern: Async HTTP wrappers with auth

**`engine/src/server/`:**
- Purpose: FastAPI application and request handlers
- Contains: App factory, middleware, route definitions, firewall sanitization
- Key files: `app.py` (app factory), `routes/api.py` (endpoints), `firewall.py` (output sanitization), `scanner.py` (orchestration)

**`web/`:**
- Purpose: Next.js 16 frontend with React 19 components
- Contains: Pages, routes, components, libraries, database schema
- Entry point: `src/app/page.tsx` (redirects to login or dashboard)

**`web/src/app/`:**
- Purpose: Next.js app directory — file-based routing
- Structure:
  - `page.tsx` at root level → / route
  - `login/page.tsx` → /login
  - `(dashboard)/` → route group (shared layout)
  - `(dashboard)/dashboard/page.tsx` → /dashboard
  - `(dashboard)/settings/page.tsx` → /settings
  - `api/` → API route handlers (edge functions)
- Paradigm: Server components by default; `"use client"` for interactive components

**`web/src/app/(dashboard)/`:**
- Purpose: Protected route group with shared DashboardShell layout
- Files: `layout.tsx` (auth guard + shell wrapper), `dashboard/page.tsx`, `settings/page.tsx`
- Auth enforcement: `layout.tsx` calls `auth()`, redirects to /login if no session

**`web/src/app/api/`:**
- Purpose: API route handlers — proxies between browser and engine
- Pattern: Each route POST/GET checks auth, calls engine lib, returns JSON
- Error handling: Try-catch → console.error → generic 500 response
- Key routes:
  - `scan/route.ts` — Fetch encrypted keys, proxy to /api/scan on engine
  - `trade/route.ts` — Execute trade via engine, log to DB
  - `keys/route.ts` — Store/retrieve encrypted API credentials (GET/POST/DELETE)
  - `trades/route.ts` — Fetch user's trade history (last 50, sorted newest-first)
  - `sync/route.ts` — Check Kalshi for settlements, update PnL

**`web/src/components/dashboard/`:**
- Purpose: Dashboard UI components
- Files:
  - `DashboardShell.tsx` — Layout wrapper (sticky nav, user menu, main content area)
  - `SignalCard.tsx` — Individual signal card (asset, direction, stars, trade button)
  - `StatsRow.tsx` — Performance metrics row (balance, pnl, win rate)
  - `PerformanceChart.tsx` — Chart.js PnL over time
  - `TradeHistory.tsx` — Sortable/filterable trade table
  - `EmptyState.tsx` — "Connect keys" or "Scanning..." placeholder

**`web/src/lib/`:**
- Purpose: Shared utility libraries (not React components)
- Files:
  - `auth.ts` — NextAuth v5 config, Google provider, JWT callbacks
  - `engine.ts` — Type-safe HTTP client for engine, request/response interfaces
  - `crypto.ts` — Fernet encrypt/decrypt (shared key with engine)
  - `prisma.ts` — Prisma client singleton (prevents multiple instances in dev)

**`web/src/types/`:**
- Purpose: Global TypeScript type definitions and extensions
- Files:
  - `next-auth.d.ts` — Extend NextAuth session to include user.id
  - `fernet.d.ts` — Declare types for fernet npm package

**`web/prisma/`:**
- Purpose: Prisma ORM schema and migrations
- Files:
  - `schema.prisma` — Database schema (models, relations, indexes)
  - `migrations/` — SQL migration files (one per schema change)
- Pattern: `prisma db push` applies changes; `prisma generate` creates types

## Key File Locations

**Entry Points:**
- `web/src/app/page.tsx` — Root landing/redirect page
- `web/src/app/(dashboard)/dashboard/page.tsx` — Main dashboard (client component with interactive state)
- `web/src/app/(dashboard)/settings/page.tsx` — Key management UI
- `engine/src/server/app.py` — FastAPI app factory (entry for server startup)

**Configuration:**
- `web/tsconfig.json` — TypeScript compiler options (paths: @/* → src/*)
- `web/next.config.ts` — Next.js config (currently minimal)
- `web/package.json` — npm dependencies and scripts (dev, build, start)
- `engine/pyproject.toml` — Python dependencies and metadata
- `engine/config/settings.yaml` — Platform-specific settings (Kalshi endpoints, asset list)

**Core Logic:**
- `web/src/lib/auth.ts` — NextAuth configuration and callbacks
- `web/src/lib/engine.ts` — Engine API client (all external calls)
- `engine/src/core/strategy.py` — Black-Scholes signal detection
- `engine/src/server/firewall.py` — Output sanitization (strips strategy internals)
- `engine/src/server/scanner.py` — Orchestration (scan, trade, sync operations)

**Testing:**
- Not found; no test files present in codebase

**Database:**
- `web/prisma/schema.prisma` — Single source of truth for schema
- `web/.env.local` — Local DATABASE_URL (points to Neon in production)

## Naming Conventions

**Files:**
- TypeScript/React files: `camelCase.tsx` for components, `camelCase.ts` for utilities
  - Examples: `SignalCard.tsx`, `engine.ts`, `middleware.ts`
- Python files: `snake_case.py`
  - Examples: `strategy.py`, `kalshi.py`, `firewall.py`
- Config files: lowercase with dots
  - Examples: `tsconfig.json`, `next.config.ts`, `pyproject.toml`

**Directories:**
- Feature directories: kebab-case or singular nouns
  - Examples: `src/app/(dashboard)`, `src/components/dashboard`, `engine/src/exchanges`
- Route groups (Next.js): Parentheses notation
  - Example: `(dashboard)` groups routes under shared layout without appearing in URL

**Functions:**
- TypeScript: camelCase
  - Examples: `scanSignals()`, `executeTrade()`, `DashboardShell()`
- Python: snake_case
  - Examples: `run_scan()`, `sync_trades_for_user()`, `sanitize_recommendation()`

**Variables:**
- TypeScript: camelCase for all variable types
  - Examples: `apiKey`, `isScanning`, `userData`
- Python: snake_case
  - Examples: `api_key_enc`, `user_id`, `settled_price`

**Types/Interfaces:**
- TypeScript: PascalCase
  - Examples: `Signal`, `ScanRequest`, `TradeResponse`, `DashboardShellProps`
- Python: PascalCase for Pydantic models
  - Examples: `ScanRequest`, `TradeRequest`, `TradeRecommendation`

**Constants:**
- TypeScript: UPPER_SNAKE_CASE or camelCase depending on scope
  - Examples: `ENABLED_ASSETS`, `_SIGNAL_TIERS`, `ENGINE_URL`
- Python: UPPER_SNAKE_CASE
  - Examples: `ENGINE_API_KEY`, `PNL_DIR`

## Where to Add New Code

**New Feature (e.g., new dashboard metric):**
- New component: `web/src/components/dashboard/NewComponent.tsx`
- Styling: Tailwind classes inline (CSS in `web/src/app/globals.css` for global styles)
- Type definitions: Add interfaces to component file or `web/src/types/index.ts` if shared
- If needs data: Add route to `web/src/app/api/` or extend existing route

**New Component/Module:**
- Reusable UI component: `web/src/components/[domain]/ComponentName.tsx`
- Server utility: `web/src/lib/[name].ts`
- Shared types: `web/src/types/[domain].ts`
- API integration: Extend `web/src/lib/engine.ts` with new method

**New API Endpoint (web layer):**
- Location: `web/src/app/api/[endpoint]/route.ts`
- Pattern:
  ```typescript
  export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    // Business logic
    return NextResponse.json(result);
  }
  ```

**New Engine Functionality:**
- Signal detection improvement: Modify `engine/src/core/strategy.py`
- New exchange: Create `engine/src/exchanges/[exchange].py` with async client
- New API endpoint: Add to `engine/src/server/routes/api.py` with Pydantic model + handler
- Output sanitization: Update `engine/src/server/firewall.py` if new field exposed

**Database Schema Change:**
- Edit `web/prisma/schema.prisma`
- Run `npx prisma migrate dev --name [description]` (creates migration + applies)
- Regenerate types: `npx prisma generate`
- Push to Neon: Automatic on `vercel deploy` or manual `npx prisma db push`

**Utilities:**
- Shared crypto functions: `web/src/lib/crypto.ts`
- Shared API client: `web/src/lib/engine.ts` (add interface + function)
- Environment config: Reference `process.env.*` in route handlers or lib functions

## Special Directories

**`web/public/`:**
- Purpose: Static assets served directly by Next.js (no bundling)
- Contains: favicon.ico, robots.txt, etc.
- Generated: No
- Committed: Yes

**`web/.next/`:**
- Purpose: Build output directory
- Contains: Compiled bundles, cached assets, server functions
- Generated: Yes (created by `npm run build`)
- Committed: No (in .gitignore)

**`engine/data/pnl/`:**
- Purpose: Local JSON storage for trade records (standalone mode only)
- Contains: Trade history, PnL calculations
- Generated: Yes (created at runtime)
- Committed: No (in .gitignore)

**`web/prisma/migrations/`:**
- Purpose: SQL migration history (one file per schema change)
- Generated: Yes (created by `npx prisma migrate dev`)
- Committed: Yes (part of version control)

**`web/node_modules/`:**
- Purpose: npm package dependencies
- Generated: Yes (created by `npm install`)
- Committed: No (in .gitignore)

**`engine/.venv/` or `.venv/`:**
- Purpose: Python virtual environment
- Generated: Yes (created by `python -m venv .venv`)
- Committed: No (in .gitignore)

---

*Structure analysis: 2026-02-26*
