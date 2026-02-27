# Codebase Concerns

**Analysis Date:** 2026-02-26

## Tech Debt

**Monolithic components (LandingPage, DashboardPage):**
- Issue: `LandingPage.tsx` is 476 lines, `DashboardPage` is 392 lines. These mix presentation, business logic, state management, and API calls in a single file.
- Files: `web/src/components/landing/LandingPage.tsx`, `web/src/app/(dashboard)/dashboard/page.tsx`
- Impact: Hard to test, difficult to reuse subcomponents, performance degradation, makes refactoring risky
- Fix approach: Extract subcomponents (HeroSection, FeaturesSection, StepsSection for landing; SignalsSection, StatsSection, CookingTradesSection for dashboard), move state management to custom hooks

**Silent error handling in data fetches:**
- Issue: Trade history and settlement sync fail silently with `.catch()` without logging or user feedback
- Files: `web/src/app/(dashboard)/dashboard/page.tsx` lines 76-78, 92-94
- Impact: Users don't know when trade data is stale; potential missed updates on market settlements
- Fix approach: Add user-visible error toasts for critical fetch failures; log non-critical failures (trades are supplementary)

**Unvalidated JSON parsing:**
- Issue: `/api/scan` route uses `.catch(() => ({}))` to handle malformed JSON, silently defaulting to empty object
- Files: `web/src/app/api/scan/route.ts` line 34
- Impact: Requests with invalid JSON proceed without error, may cause unexpected behavior downstream
- Fix approach: Explicitly validate request body shape with zod or similar; return 400 with clear error message for malformed JSON

**Input parsing without validation:**
- Issue: `/api/trade` uses `parseFloat()` and `parseInt()` on user input without bounds checking or NaN handling
- Files: `web/src/app/api/trade/route.ts` lines 51-52, 63-64
- Impact: Negative prices/counts, extremely large numbers, NaN values could be sent to exchange API
- Fix approach: Add schema validation (zod/joi) to parse and validate all numeric inputs; enforce positive bounds

**Floating point precision in calculations:**
- Issue: Cumulative PnL calculations use `parseFloat(cum.toFixed(4))` which can accumulate rounding errors over many trades
- Files: `web/src/components/dashboard/PerformanceChart.tsx` line 82, `web/src/app/(dashboard)/dashboard/page.tsx` line 246
- Impact: Long-term PnL charts show incorrect cumulative values; user sees inaccurate performance
- Fix approach: Use integer arithmetic (track in cents) or decimal library; recalculate cumulative from settled trades rather than running sum

**Encryption key reuse across all users:**
- Issue: All users' API keys share a single `FERNET_KEY` environment variable
- Files: `web/src/lib/crypto.ts`, `web/src/app/api/keys/route.ts`
- Impact: If `FERNET_KEY` is compromised, all encrypted keys become decryptable; no per-user or per-tenant isolation
- Fix approach: (Future) Implement key derivation per user ID or move to Vault/KMS with per-secret encryption

## Known Bugs

**Duplicate order prevention broken on client refresh:**
- Symptoms: If user hits F5 during cooldown, the `recentTrades` Map is cleared; same signal can be executed again immediately
- Files: `web/src/app/(dashboard)/dashboard/page.tsx` lines 57-58, 142-153
- Trigger: Execute a signal, then refresh page before 120s cooldown expires
- Workaround: Check Kalshi order history to cancel duplicates manually
- Fix approach: Move duplicate guard to backend; check trades DB before allowing execution, enforce cooldown at API layer

**Audio context creation not idempotent:**
- Symptoms: Multiple rapid signal detections create multiple AudioContext instances; may cause browser warnings or sound clipping
- Files: `web/src/app/(dashboard)/dashboard/page.tsx` lines 205-221, `engine/src/static/js/goldfinger.js` lines 295-334
- Trigger: Auto-scan finds multiple signals in sequence (within 100ms)
- Workaround: Browser handles gracefully; only one sound plays
- Fix approach: Create AudioContext once at component mount; reuse single context instance for all alerts

**Stats calculation misalignment between engine and UI:**
- Symptoms: Engine returns `stats` with all zeroes in multi-user mode; UI falls back to computing from trades, but balance is lost
- Files: `web/src/app/(dashboard)/dashboard/page.tsx` lines 228-252; engine multi-user mode returns `{ balance: 0, ... }`
- Trigger: Use multi-user engine; scan returns stats=all zeros
- Workaround: UI computes win_rate and pnl from trades, but balance stays 0
- Fix approach: Ensure engine always returns accurate per-user balance; document why stats come from engine vs DB

**Refetch race on trade execution:**
- Symptoms: After trade execution, page refetches trades (line 174) and re-scans (line 175 with 2s delay). If both complete out-of-order, UI shows stale signals
- Files: `web/src/app/(dashboard)/dashboard/page.tsx` lines 173-175
- Trigger: Execute trade, network is slow
- Workaround: Auto-scan picks up changes on next cycle
- Fix approach: Use Promise.all to ensure both complete; add sequential dependency so re-scan waits for trade fetch

**Chart memory leak on rapid trades:**
- Symptoms: `chartRef.current.destroy()` is called but chart instances may not fully clean up event listeners in some browsers
- Files: `web/src/components/dashboard/PerformanceChart.tsx` lines 54-56
- Trigger: Perform many trades rapidly (every few seconds), watch DevTools memory
- Impact: Slow browser performance over time
- Fix approach: Add explicit cleanup for all chart event listeners; consider using chart library with better cleanup (e.g., ECharts)

## Security Considerations

**Encrypted keys stored with single shared key:**
- Risk: All users' Kalshi credentials encrypted with same `FERNET_KEY`; if leaked, all accounts compromised
- Files: `web/src/lib/crypto.ts`, database `UserApiKey` table
- Current mitigation: Environment variable, not in code; Fernet provides authenticated encryption
- Recommendations: Implement key derivation per user (using user ID as salt); move to managed secrets service (AWS Secrets Manager, Vault); rotate master key periodically

**No rate limiting on API scan endpoint:**
- Risk: User can spam `/api/scan` endpoint to consume engine resources, trigger excessive Kalshi API calls
- Files: `web/src/app/api/scan/route.ts`
- Current mitigation: Database tracks `scansToday` count but does not enforce limit
- Recommendations: Add middleware to enforce rate limit (max 50 scans/day for free tier); return 429 when exceeded

**No rate limiting on trade execution endpoint:**
- Risk: User can rapidly execute trades with large order volumes; no validation of order count or frequency
- Files: `web/src/app/api/trade/route.ts`
- Current mitigation: Duplicate guard in client (120s cooldown per ticker)
- Recommendations: Add backend rate limiting (e.g., max 10 trades/minute); validate count against account balance

**Error messages leak internal state:**
- Risk: Generic error messages are good, but if engine crashes, stack traces might be logged and exposed in console
- Files: `web/src/app/api/*.ts` all log errors to console
- Current mitigation: Errors returned to client are generic
- Recommendations: Log full errors server-side with request ID; return request ID in error response for support lookup

**Fernet TTL set to zero:**
- Risk: Encrypted keys have no expiration; compromise is permanent until key is manually rotated
- Files: `web/src/lib/crypto.ts` line 35
- Current mitigation: Keys are only decrypted server-side in memory
- Recommendations: Set TTL to reasonable value (e.g., 86400 = 24 hours); re-encrypt keys on use to refresh TTL

**No input sanitization on trade ticker:**
- Risk: Ticker name not validated before sending to Kalshi API; malformed ticker could cause errors or injection
- Files: `web/src/app/api/trade/route.ts` line 49 (ticker passed through without validation)
- Current mitigation: Engine validates on receive, but no frontend validation
- Recommendations: Validate ticker format matches Kalshi's format (e.g., regex `^[A-Z0-9-]+$`); check against known markets list

## Performance Bottlenecks

**Large monolithic components block rendering:**
- Problem: `LandingPage` (476 lines) and `DashboardPage` (392 lines) render all child components even if off-screen
- Files: `web/src/components/landing/LandingPage.tsx`, `web/src/app/(dashboard)/dashboard/page.tsx`
- Cause: No code-splitting, no lazy loading; React rerenders entire tree on any state change
- Improvement path: Extract subcomponents, use React.memo for static sections, lazy-load charts with Suspense

**Trade history table not paginated:**
- Problem: Fetches all trades (capped at 50 in DB, but still renders all at once)
- Files: `web/src/app/api/trades/route.ts`, `web/src/components/dashboard/TradeHistory.tsx`
- Cause: Simple `.findMany()` with take:50, no cursor-based pagination
- Improvement path: Implement cursor pagination in API, render table with virtual scrolling (react-window)

**Audio context created synchronously on every alert:**
- Problem: `new AudioContext()` blocks JS thread; multiple alerts in quick succession create multiple contexts
- Files: `web/src/app/(dashboard)/dashboard/page.tsx` lines 205-221
- Cause: No pooling or reuse of audio context
- Improvement path: Create single AudioContext at app root; reuse for all alerts; move to Web Audio API worker if possible

**Chart.js re-renders entire chart on every trade update:**
- Problem: Every time trades array changes, entire chart destroyed and recreated
- Files: `web/src/components/dashboard/PerformanceChart.tsx` lines 54-56
- Cause: No diffing of trade data; full re-render in useEffect
- Improvement path: Implement incremental chart updates (append new data points) or use Canvas-based charting library with better diff support

**Database query for stats on every scan:**
- Problem: `/api/scan` calls `prisma.user.update()` to increment `scansToday` and update `lastScanAt` on every scan
- Files: `web/src/app/api/scan/route.ts` lines 45-52
- Cause: Synchronous DB write on hot path
- Improvement path: Batch updates to Redis; flush to DB once per minute; remove from critical path

## Fragile Areas

**Dashboard state synchronization (signal list ↔ trade history ↔ stats):**
- Files: `web/src/app/(dashboard)/dashboard/page.tsx` lines 45-252
- Why fragile: Three separate state arrays (signals, trades, stats) fetched from different endpoints; no guarantee they reflect same moment in time. Auto-scan can trigger fetches mid-way through user action.
- Safe modification: Add request-time versioning (e.g., `scanId`) to tie all responses to same scan moment; only update state if response is newer than current state
- Test coverage: No unit tests; no integration tests for state transitions

**API key encryption/decryption round-trip:**
- Files: `web/src/lib/crypto.ts`, `web/src/app/api/keys/route.ts`, `engine/src/**` (decryption)
- Why fragile: Single shared key, no validation that decrypted key is valid before use; network failure during sync could leave DB in bad state
- Safe modification: Add key validation endpoint that tests encryption/decryption; validate keys on save with exchange API test request
- Test coverage: No round-trip encryption tests; no tests with actual Kalshi API credentials

**Duplicate trade prevention with 120s client-side cooldown:**
- Files: `web/src/app/(dashboard)/dashboard/page.tsx` lines 142-153, `recentTrades.current` Map
- Why fragile: Cooldown is lost on page reload; relies on client-side timestamp comparison; server has no awareness
- Safe modification: Move duplicate prevention to API layer; check `trades` table for recent execution of same ticker before allowing new trade
- Test coverage: No tests for cooldown logic; no tests for page reload scenario

**Settings page `connected` boolean toggle:**
- Files: `web/src/app/(dashboard)/settings/page.tsx` lines 128-129
- Why fragile: Clicking "Update Keys" button sets `connected=false` but doesn't clear form; user could accidentally submit empty keys
- Safe modification: Show "Update" mode with separate form state; disable "Save" button if fields are empty; show confirmation before overwriting existing keys
- Test coverage: No tests for settings form

## Scaling Limits

**Single FERNET_KEY for all users:**
- Current capacity: Unlimited users (no technical limit)
- Limit: Security limit — one leaked key compromises all users
- Scaling path: Move to per-user key derivation; use AWS Secrets Manager or HashiCorp Vault for key management

**Database query without pagination:**
- Current capacity: Handles 50 trades per user without issue
- Limit: If user has 10,000+ trades, page becomes unresponsive
- Scaling path: Implement cursor-based pagination in trades endpoint; use virtual scrolling in UI

**Auto-scan interval hardcoded to 45s:**
- Current capacity: Single user scanning 24/7 = ~1,900 scans/day
- Limit: If 100 users all scan simultaneously, engine receives 100 requests/45s = 2.2 req/s
- Scaling path: Implement job queue (Redis Queue, Bull); distribute scans over time; add configurable scan interval per tier

**No connection pooling to engine:**
- Current capacity: Each API call creates new HTTP connection to engine
- Limit: Under high concurrency (100+ simultaneous users), connection overhead becomes significant
- Scaling path: Use connection pool library (node-pool); implement persistent gRPC connections instead of HTTP

**Audio context reuse limit:**
- Current capacity: ~10 rapid alerts before audio quality degrades
- Limit: Browser limits context creation to prevent abuse
- Scaling path: Pre-create single context at app root; queue alerts in array and play sequentially

## Dependencies at Risk

**NextAuth v5.0.0-beta.30 (still in beta):**
- Risk: API not finalized; breaking changes possible in minor versions
- Impact: Security patches may require migration; stability not guaranteed
- Migration plan: Pin to stable release when available (v5.0.0+); set up CI to test beta upgrades

**Fernet v0.3.3 (unmaintained):**
- Risk: Package has not been updated since 2018; no security patches for newly discovered vulnerabilities
- Impact: If Fernet has implementation bugs, no upstream fix available
- Migration plan: Test against official Python cryptography library before using in production; consider switching to `tweetnacl.js` for encryption

**Chart.js v4.5.1 (moderate uptake):**
- Risk: Canvas-based charting has known performance issues with large datasets
- Impact: Trade history charts slow down with 100+ trades
- Migration plan: Evaluate ECharts or Recharts for better performance; implement lazy-loading for historical data

## Missing Critical Features

**No rate limiting or scan quota enforcement:**
- Problem: Users can run unlimited scans; no tie to tier (free/pro/admin)
- Blocks: Monetization (can't charge for pro tier); resource control
- Priority: High (blocks business model)

**No order confirmation UI:**
- Problem: Trade executes immediately on button click; no "are you sure?" dialog
- Blocks: High-stakes trading workflow (user needs friction before spending money)
- Priority: High (risk of accidental large orders)

**No API key rotation:**
- Problem: Once stored, keys can't be rotated without manually deleting and re-adding
- Blocks: Security hardening; compliance with credential hygiene policies
- Priority: Medium (important for enterprise adoption)

**No webhook/notification integration:**
- Problem: User must keep page open to see signals; no Slack/Discord/email alerts
- Blocks: Mobile-first workflow; can't trade while away from dashboard
- Priority: Medium (improves UX)

**No PNL per-signal attribution:**
- Problem: Dashboard shows total PnL but not which signals generated profit/loss
- Blocks: Strategy improvement (user can't see what works)
- Priority: Medium (needed for feedback loop)

## Test Coverage Gaps

**No tests for duplicate trade prevention:**
- What's not tested: Client-side cooldown logic, page reload scenario, server-side validation
- Files: `web/src/app/(dashboard)/dashboard/page.tsx` lines 142-153, `web/src/app/api/trade/route.ts`
- Risk: Users could execute same signal twice in quick succession unintentionally
- Priority: High

**No tests for state synchronization:**
- What's not tested: Signals array, trades array, and stats array staying in sync after async operations
- Files: `web/src/app/(dashboard)/dashboard/page.tsx` lines 45-252
- Risk: UI shows stale data; user makes decisions on incorrect information
- Priority: High

**No tests for encryption round-trip:**
- What's not tested: API keys encrypted, stored, retrieved, decrypted without corruption
- Files: `web/src/lib/crypto.ts`, `web/src/app/api/keys/route.ts`
- Risk: Keys become corrupted silently; users can't trade
- Priority: High

**No tests for API input validation:**
- What's not tested: Invalid JSON, missing fields, out-of-bounds numbers in trade requests
- Files: `web/src/app/api/trade/route.ts`, `web/src/app/api/scan/route.ts`
- Risk: Invalid requests pass through to engine; engine may crash or behave unexpectedly
- Priority: Medium

**No tests for settings form:**
- What's not tested: Save API keys, delete keys, update existing keys, form validation
- Files: `web/src/app/(dashboard)/settings/page.tsx`
- Risk: Users can't manage credentials; silent failures on save
- Priority: Medium

**No tests for trade history UI:**
- What's not tested: Status badges, PnL formatting, pagination, sorting
- Files: `web/src/components/dashboard/TradeHistory.tsx`, `web/src/app/api/trades/route.ts`
- Risk: Trade history displays incorrect values (e.g., wrong status color)
- Priority: Low (visual issues, not functional)

**No E2E tests:**
- What's not tested: Full flow from login → set keys → scan → execute trade → sync settlement
- Risk: Changes to one part of the flow break the entire workflow undetected
- Priority: High (critical path needs protection)

---

*Concerns audit: 2026-02-26*
