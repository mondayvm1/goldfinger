# Technology Stack

**Analysis Date:** 2026-02-26

## Languages

**Primary:**
- TypeScript 5 - Web frontend and API routes (`web/src/**/*.ts`, `web/src/**/*.tsx`)
- Python 3.9+ - Engine backend, signal detection, exchange clients (`engine/src/**/*.py`)

**Secondary:**
- JavaScript (Node.js) - PostCSS config (`web/postcss.config.mjs`)

## Runtime

**Environment:**
- Node.js (version not specified, but supports Next.js 16) - Web/frontend runtime
- Python 3.9+ - Engine runtime (specified in `engine/pyproject.toml`)

**Package Managers:**
- npm (v3 lockfile format) - Web dependencies
  - Lockfile: `web/package-lock.json` (present)
- pip/setuptools - Python dependencies via `engine/pyproject.toml`
  - Build system: setuptools + wheel

## Frameworks

**Core:**
- **Next.js** 16.1.6 - Full-stack web framework with React (`web/package.json`)
- **React** 19.2.3 - UI component library (`web/`)
- **FastAPI** 0.115+ - Python async API framework (`engine/pyproject.toml`)

**Testing:**
- pytest 8.0+ - Python unit/integration testing (`engine/pyproject.toml`)
- pytest-asyncio 0.23+ - Async test support for Python (`engine/pyproject.toml`)
- *No test framework detected for TypeScript/React frontend*

**Build/Dev:**
- **Tailwind CSS** 4 - Utility-first CSS framework (`web/package.json`, `web/postcss.config.mjs`)
- **Tailwind PostCSS** @4 - PostCSS plugin for Tailwind (`web/package.json`)
- **TypeScript** 5 - Type checking and compilation (`web/package.json`)
- **Prisma** 5.22.0 - ORM for database (`web/package.json`, `web/prisma/schema.prisma`)

## Key Dependencies

**Critical:**
- **@prisma/client** 5.22.0 - Database ORM client (`web/package.json`)
  - Prisma schema: `web/prisma/schema.prisma`
- **next-auth** 5.0.0-beta.30 - Authentication framework with Google OAuth (`web/package.json`)
- **@auth/prisma-adapter** 2.11.1 - NextAuth adapter for Prisma (`web/package.json`)

**Cryptography:**
- **cryptography** 42.0+ - RSA-PSS signatures, PEM key handling (Python) (`engine/pyproject.toml`)
- **fernet** 0.3.3 - Symmetric encryption for storing user API keys (Node.js) (`web/package.json`)

**Infrastructure:**
- **httpx** 0.27+ - Async HTTP client for exchange APIs (Python) (`engine/pyproject.toml`)
- **websockets** 12.0+ - WebSocket support for real-time market data (Python) (`engine/pyproject.toml`)
- **py-clob-client** 0.1.0+ - Polymarket CLOB client library (Python) (`engine/pyproject.toml`)
- **eth_account** (implicit via py-clob-client) - Ethereum account management for Polymarket

**Data & Scientific:**
- **pandas** 2.0+ - Data manipulation and analysis (Python) (`engine/pyproject.toml`)
- **scipy** 1.10+ - Black-Scholes pricing calculations (Python) (`engine/pyproject.toml`)
- **pydantic** 2.0+ - Data validation (Python) (`engine/pyproject.toml`)
- **pydantic-settings** 2.0+ - Environment-based configuration (Python) (`engine/pyproject.toml`)

**UI/Visualization:**
- **chart.js** 4.5.1 - Charting library for performance graphs (`web/package.json`)
- **react-chartjs-2** 5.3.1 - React wrapper for Chart.js (`web/package.json`)

**Utilities:**
- **uvicorn[standard]** 0.30+ - ASGI server for FastAPI (Python) (`engine/pyproject.toml`)
- **jinja2** 3.1+ - Template rendering (Python) (`engine/pyproject.toml`)
- **python-dotenv** 1.0+ - Load .env files (Python) (`engine/pyproject.toml`)
- **pyyaml** 6.0+ - YAML config file parsing (Python) (`engine/pyproject.toml`)
- **rich** 13.0+ - CLI output formatting (Python) (`engine/pyproject.toml`)

**Development:**
- ipython 8.0+ - Interactive Python shell (`engine/pyproject.toml` optional-dependencies)

## Configuration

**Environment:**
- Web: `.env.local` - NextAuth, database, engine connection, Google OAuth secrets
  - Template: `web/.env.local.example`
  - Key vars: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FERNET_KEY`, `ENGINE_URL`, `ENGINE_API_KEY`

- Engine: `.env` - Kalshi credentials, Fernet key, service auth, CORS
  - Template: `engine/.env.example`
  - Key vars: `KALSHI_API_KEY`, `KALSHI_PRIVATE_KEY_PATH`, `FERNET_KEY`, `ENGINE_API_KEY`, `CORS_ORIGINS`

- Platform Config: `engine/config/settings.yaml` - Kalshi/Polymarket URLs, arbitrage parameters, logging
  - Defines demo vs production API endpoints
  - Configures min spread thresholds, max position size, polling intervals

**Build:**
- `web/tsconfig.json` - TypeScript compiler configuration (ES2017 target, strict mode, path aliases)
- `web/next.config.ts` - Next.js configuration (minimal, using defaults)
- `engine/pyproject.toml` - Python project metadata, dependencies, entry points
- `web/postcss.config.mjs` - PostCSS pipeline with Tailwind plugin

## Platform Requirements

**Development:**
- Node.js (version TBD, compatible with Next.js 16)
- Python 3.9 or higher
- npm or yarn package manager
- Kalshi API credentials (demo: https://demo-api.kalshi.co, prod: https://api.elections.kalshi.com)
- Optional: Polymarket credentials (CLOB API)

**Production:**
- **Web:** Deployed on Vercel (Next.js hosting)
  - Database: Neon serverless Postgres (PostgreSQL-compatible)
  - Environment: `.env.local` with production secrets
- **Engine:** Standalone Python process
  - Can run on any system with Python 3.9+
  - Listens on port 8050 (configurable via settings.yaml or CORS_ORIGINS)
  - Uses httpx for async HTTP, uvicorn as ASGI server

---

*Stack analysis: 2026-02-26*
