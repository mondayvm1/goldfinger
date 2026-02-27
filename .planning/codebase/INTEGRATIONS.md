# External Integrations

**Analysis Date:** 2026-02-26

## APIs & External Services

**Prediction Markets:**
- **Kalshi** - Binary options on Bitcoin/Ethereum (15-min expiry)
  - SDK/Client: `engine/src/exchanges/kalshi.py` (custom httpx-based client)
  - API Endpoints:
    - Demo: `https://demo-api.kalshi.co/trade-api/v2`
    - Production: `https://api.elections.kalshi.com/trade-api/v2`
    - WebSocket: `wss://demo-api.kalshi.co/trade-api/ws/v2` and `wss://api.elections.kalshi.com/trade-api/ws/v2`
  - Auth: RSA-PSS signatures (private key + API key ID)
    - API Key env var: `KALSHI_API_KEY`
    - Private Key file: `KALSHI_PRIVATE_KEY_PATH` (PEM format, cryptography library)
  - Authentication flow:
    - Request timestamp + method + path signed with private key
    - Signature validated server-side using public key
    - Supports both standalone mode (from .env) and multi-user mode (from request payload)

- **Polymarket** - Crypto prediction markets (CLOB order book)
  - SDK/Client: `engine/src/exchanges/polymarket.py` (custom httpx-based client)
  - API Endpoints:
    - CLOB: `https://clob.polymarket.com`
    - Gamma: `https://gamma-api.polymarket.com`
    - Data: `https://data-api.polymarket.com`
    - WebSocket: `wss://ws-subscriptions-clob.polymarket.com/ws/market`
  - Auth: Optional Ethereum wallet + API credentials (api_key, api_secret, api_passphrase)
    - Private key derivation via eth_account library
  - Used for: Cross-platform market matching and arbitrage detection

## Data Storage

**Databases:**
- **Neon** (serverless PostgreSQL)
  - Connection: Environment variable `DATABASE_URL`
  - Format: `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/goldfinger?sslmode=require`
  - Client: Prisma ORM (`@prisma/client` 5.22.0)
  - SSL required for connections

**Database Schema (`web/prisma/schema.prisma`):**
- **User** - NextAuth model, includes tier (free/pro/admin), scan limits, timestamps
- **Account** - OAuth provider details (Google)
- **Session** - JWT session tokens
- **VerificationToken** - Email verification tokens
- **UserApiKey** - Encrypted API credentials per exchange (Kalshi/Polymarket)
  - Unique constraint: `[userId, exchange]`
  - Fields: `apiKeyEnc`, `privateKeyEnc` (both Fernet-encrypted)
- **Trade** - Trade history and settlement tracking
  - Indexes: `[userId]`, `[userId, ticker]`, `[status]` for query performance
  - Fields: orderId, ticker, side, price, count, fee, pnl, settledPrice, status

**File Storage:**
- Local filesystem only (no S3, GCS, etc.)
- Log data stored in `data/spreads/` (configurable via settings.yaml)

**Caching:**
- None detected. Real-time data fetched directly from market APIs via httpx

## Authentication & Identity

**Auth Provider:**
- **Google OAuth 2.0** - Multi-user authentication
  - Implementation: NextAuth v5 with PrismaAdapter
  - Configuration file: `web/src/lib/auth.ts`
  - Session strategy: JWT
  - Credentials: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (from Google Cloud Console)
  - Redirect: `/login` page for sign-in flow
  - User data stored in Postgres via Prisma

**Service-to-Service Auth:**
- **Engine API Key** - Header-based authentication for Next.js → Engine calls
  - Header name: `X-Engine-Key`
  - Environment variable: `ENGINE_API_KEY`
  - Enforced in `engine/src/server/app.py` middleware
  - Skipped for: local dashboard routes, `/api/health`, health checks

**Credential Encryption:**
- **Fernet** (symmetric encryption) - Store user Kalshi/Polymarket credentials
  - Key: Shared `FERNET_KEY` between web and engine
  - Python implementation: `engine/src/crypto.py` (cryptography.fernet.Fernet)
  - Node.js implementation: `web/src/lib/crypto.ts` (fernet npm package v0.3.3)
  - Used for: Encrypt `UserApiKey.apiKeyEnc` and `UserApiKey.privateKeyEnc` at rest
  - Decryption happens in-memory during API calls, never stored plaintext

## Monitoring & Observability

**Error Tracking:**
- Not detected - No Sentry, Datadog, or similar integration

**Logs:**
- Console-based logging via Python logging module
  - Log level configurable in `engine/config/settings.yaml` (default: INFO)
  - Rich CLI formatting via `rich` library for human-readable output
  - Spread data logged to `data/spreads/` directory

## CI/CD & Deployment

**Hosting:**
- **Web:** Vercel (Next.js deployment platform)
  - CORS origin: `https://goldfinger.vercel.app`
  - Automatic deployments from git (likely from main/dev branches)

- **Engine:** Standalone Python process
  - Manual deployment or custom CI/CD
  - Listens on localhost:8050 (configurable)
  - CORS middleware configured to allow Vercel frontend

**CI Pipeline:**
- Not detected - No GitHub Actions, GitLab CI, or similar config files

## Environment Configuration

**Required env vars - Web (.env.local):**
- `DATABASE_URL` - Neon Postgres connection string with SSL
- `NEXTAUTH_URL` - NextAuth base URL (e.g., http://localhost:3000)
- `NEXTAUTH_SECRET` - Random key for JWT signing (generate: `openssl rand -base64 32`)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `FERNET_KEY` - Encryption key shared with engine (generate: `python -m src.crypto`)
- `ENGINE_URL` - Engine API endpoint (e.g., http://localhost:8050)
- `ENGINE_API_KEY` - Service-to-service authentication key

**Required env vars - Engine (.env):**
- `KALSHI_API_KEY` - Kalshi API key ID (from https://kalshi.com/account/api)
- `KALSHI_PRIVATE_KEY_PATH` - Path to PEM private key file (e.g., config/kalshi_private_key.pem)
- `FERNET_KEY` - Encryption key (shared with web, generate if missing)
- `ENGINE_API_KEY` - Service-to-service authentication key (enforce in multi-user mode)
- `CORS_ORIGINS` - Comma-separated list (default: http://localhost:3000,https://goldfinger.vercel.app)

**Optional env vars - Engine:**
- Polymarket credentials (if arbitrage mode enabled): api_key, api_secret, api_passphrase, or private_key

**Secrets location:**
- Not stored in code (`.env` files in `.gitignore`)
- Configuration templates: `engine/.env.example`, `web/.env.local.example`
- Platform config: `engine/config/settings.yaml` (no secrets, only URLs and thresholds)

## Webhooks & Callbacks

**Incoming:**
- None detected - No webhook receivers for market updates or external notifications

**Outgoing:**
- None detected - No webhooks sent to external services
- Note: WebSocket connections used instead for real-time market data (Kalshi, Polymarket)

## Real-Time Data Streams

**WebSocket Connections:**
- **Kalshi WebSocket:** `wss://demo-api.kalshi.co/trade-api/ws/v2` and production endpoint
  - Used via `websockets` library (12.0+) in Python
  - Purpose: Real-time market data and order updates

- **Polymarket WebSocket:** `wss://ws-subscriptions-clob.polymarket.com/ws/market`
  - Used via `websockets` library
  - Purpose: Real-time CLOB order book updates

## API Request Patterns

**Next.js to Engine (web → engine):**
- Endpoint: `engine.src/lib/engine.ts`
- Method: POST/GET
- Auth: `X-Engine-Key` header (ENGINE_API_KEY)
- Payload format: JSON with encrypted credentials
- Routes:
  - `/api/scan` - POST scan request with `user_id`, `api_key_enc`, `private_key_enc`, `settle`
  - `/api/trade` - POST trade request with ticker, side, price, count
  - `/api/sync-trades` - POST to sync trade settlements
  - `/api/health` - GET health check (no auth required)

**Engine Internal API Routes (`engine/src/server/routes/api.py`):**
- GET `/api/scan?settle=0|1` - Standalone mode (reads .env directly)
- POST `/api/scan` - Multi-user mode (receives encrypted creds per request)
- POST `/api/trade` - Auto-detects mode from request payload
- POST `/api/sync-trades` - Sync trade settlements (multi-user)

---

*Integration audit: 2026-02-26*
