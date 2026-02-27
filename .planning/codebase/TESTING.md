# Testing Patterns

**Analysis Date:** 2026-02-26

## Test Framework

**Current State:**
- **No test suite configured** — Zero test files found in codebase
- No Jest, Vitest, or other test runner installed
- No test dependencies in `package.json`
- No test configuration files present

## Testing Gap Analysis

**What is NOT tested:**
- API routes (scan, trade, sync, keys, trades)
- Utility functions (encryption, decryption, API client)
- React components (SignalCard, DashboardShell, StatsRow, etc.)
- Critical flows (signal detection, trade execution, key management)
- Authentication and authorization middleware
- Error handling and edge cases
- Database operations (Prisma queries)

**Why this matters:**
- API routes directly interact with database and external services — changes risk silent failures
- Encryption utilities (`encrypt`/`decrypt`) are security-critical — bugs could leak credentials
- Components manage real money trades — bugs could block user execution or show incorrect data
- No regression protection when refactoring

## Recommended Test Strategy

**Priority order (if implementing):**

1. **API Route Tests (HIGH PRIORITY)**
   - `/api/scan`, `/api/trade` — these execute live trades
   - `/api/keys` — handles encrypted credentials
   - Test auth checks, validation, error handling
   - Mock `prisma` and `fetch` calls to engine

2. **Utility Tests (HIGH PRIORITY)**
   - `src/lib/crypto.ts` — encrypt/decrypt roundtrip
   - `src/lib/engine.ts` — API client construction
   - Verify encryption works cross-platform (matches Python)

3. **Component Tests (MEDIUM PRIORITY)**
   - `SignalCard` — button clicks, prop rendering
   - `DashboardPage` — state management, API integration
   - Mock fetch for scan/trade flows

4. **Integration Tests (MEDIUM PRIORITY)**
   - Full auth flow with mock database
   - Scan → Trade → Settlement flow
   - Error recovery paths

## Test Structure (if implementing)

**Recommended setup:**
```
web/
├── __tests__/
│   ├── api/
│   │   ├── scan.test.ts
│   │   ├── trade.test.ts
│   │   └── keys.test.ts
│   ├── lib/
│   │   ├── crypto.test.ts
│   │   ├── engine.test.ts
│   │   └── auth.test.ts
│   ├── components/
│   │   ├── SignalCard.test.tsx
│   │   └── DashboardPage.test.tsx
│   └── fixtures/
│       └── mockData.ts
```

**Naming convention (if implemented):**
- Test files: `[module].test.ts` or `[module].test.tsx`
- Describe blocks: test feature not file name
- Test names: describe exact behavior being tested

## Mocking Strategy (if implementing)

**What to mock:**
- `fetch` calls to engine service (use `jest.mock('node-fetch')` or `vi.mock`)
- `prisma` database queries (mock entire `prisma` module)
- `next-auth` session (mock `auth()` function)
- Environment variables (set in test setup)

**What NOT to mock:**
- NextResponse/Next.js internals (test actual Response objects)
- TypeScript types (compile away, no runtime)
- Utility functions being tested (test actual implementation)

**Example pattern (if implemented):**
```typescript
// Mock engine API client
jest.mock("@/lib/engine", () => ({
  scanSignals: jest.fn(),
  executeTrade: jest.fn(),
}));

// Mock Prisma
jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    userApiKey: {
      findUnique: jest.fn(),
    },
    trade: {
      create: jest.fn(),
    },
  },
}));

// Mock NextAuth session
jest.mock("@/lib/auth", () => ({
  auth: jest.fn().mockResolvedValue({
    user: { id: "test-user-id", email: "test@example.com" },
  }),
}));
```

## Test Data and Fixtures (if implementing)

**Location:** `__tests__/fixtures/mockData.ts`

**Example fixtures to create:**
```typescript
export const mockSignal = {
  id: "BTCUSD-1",
  asset: "BTC",
  direction: "LONG",
  entry_price: 42000,
  payout: 50000,
  size: 1,
  time_left: "14:30",
  time_left_mins: 14,
  signal_strength: 5,
  signal_label: "RSI Oversold",
};

export const mockStats = {
  balance: 10000,
  total_trades: 50,
  realized_pnl: 2500.50,
  win_rate: 64.5,
  wins: 32,
  losses: 18,
  open_positions: 3,
};

export const mockTrade = {
  id: "trade-123",
  ticker: "BTCUSD-1",
  side: "yes",
  price: 42000,
  count: 1,
  fee: 50,
  pnl: 800,
  status: "filled",
  createdAt: "2026-02-26T10:30:00Z",
};

export const mockSession = {
  user: {
    id: "user-123",
    email: "user@example.com",
    name: "Test User",
  },
};
```

## Recommended Test Coverage (if implementing)

**For API routes:**
- Auth check (unauthorized returns 401)
- Valid request → success response
- Missing fields → 400 with error message
- Engine error → 500 with error message
- Database error → 500 with error message

**For utilities:**
- Encryption roundtrip: `encrypt(plaintext) → decrypt() → plaintext`
- API client: correct headers, correct URL construction
- Type correctness: responses match interface

**For components:**
- Props render correctly
- User interactions trigger callbacks
- Loading/error states display
- Conditional rendering based on data

## Run Commands (if implementing)

**Package.json scripts to add:**
```json
{
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage"
}
```

**Installation (if implementing):**
```bash
npm install --save-dev jest @types/jest ts-jest @testing-library/react @testing-library/jest-dom
npm install --save-dev jest-mock-extended
```

**jest.config.js (if implementing):**
```javascript
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  roots: ["<rootDir>"],
  testMatch: ["**/__tests__/**/*.test.ts?(x)"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/__tests__/setup.ts"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/app/page.tsx",
  ],
};
```

## Current Testing Reality

**As of 2026-02-26:**
- No automated tests exist
- All testing is manual via browser
- High risk for regressions when refactoring
- API routes especially vulnerable to bugs (zero test coverage)
- Encryption utilities have no roundtrip verification tests

**Blocking risks:**
- Refactoring `src/lib/crypto.ts` could break Python/Node.js interoperability
- Changes to API routes could break scan/trade flows silently
- Component prop changes could break UI with no regression detection

---

*Testing analysis: 2026-02-26*
