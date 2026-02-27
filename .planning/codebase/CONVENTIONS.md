# Coding Conventions

**Analysis Date:** 2026-02-26

## Naming Patterns

**Files:**
- Components: PascalCase (`SignalCard.tsx`, `DashboardShell.tsx`, `PerformanceChart.tsx`)
- API routes: kebab-case directories matching handler names (`/api/scan/route.ts`, `/api/trade/route.ts`)
- Utility modules: camelCase (`prisma.ts`, `engine.ts`, `crypto.ts`, `auth.ts`)
- No file extensions in imports (TypeScript handles resolution)

**Functions:**
- Component exports: PascalCase for React components (`SignalCard`, `StatsRow`, `DashboardShell`)
- Utility functions: camelCase (`getSecret`, `encrypt`, `decrypt`, `engineFetch`, `fetchTrades`, `runScan`, `executeTrade`)
- Event handlers: camelCase with action prefix (`handleSave`, `handleDelete`, `handleChange`)
- Internal helpers: camelCase with descriptive names (`playAlert`, `syncTradeSettlements`, `fetchTrades`)

**Variables:**
- State variables: camelCase (`signals`, `stats`, `isScanning`, `hasKeys`, `tradingId`)
- Constants: camelCase at module level, UPPER_CASE only for magic numbers with semantic purpose
- Boolean flags: prefixed with `is`, `has`, `should`, `can` (`isLong`, `isTrading`, `hasKeys`, `isScanning`)
- Database fields: snake_case in Prisma schema (`apiKeyEnc`, `privateKeyEnc`, `createdAt`, `updatedAt`)

**Types:**
- Interface names: PascalCase (`Signal`, `Stats`, `Trade`, `SignalCardProps`, `EngineRequestOptions`, `ScanResponse`)
- Generic type parameters: single letter or descriptive (`T`, `P` for props)
- Optional types: use `Type | null` or `Type | undefined` depending on context (prefer null for data, undefined for React props)

## Code Style

**Formatting:**
- No explicit formatter (eslint/prettier) configured — follow Next.js defaults
- 2-space indentation (observed throughout codebase)
- Semicolons used consistently
- String literals: double quotes in TypeScript, backticks for template literals
- Line length: no strict limit observed, typical 80-100 chars before wrapping

**Linting:**
- No `.eslintrc` or `.prettierrc` file present — rely on TypeScript strict mode
- TypeScript compiler: `strict: true` in `tsconfig.json`
- All imports are full paths or aliased (`@/lib/*`, `@/components/*`)

## Import Organization

**Order:**
1. External libraries and frameworks (`next`, `next-auth`, `react`, `@prisma/client`)
2. Type definitions and type-only imports (`import type` for types)
3. Local imports with `@/` alias (`@/lib/*`, `@/components/*`, `@/types/*`)
4. Relative imports (rare — avoided in favor of `@/` alias)

**Path Aliases:**
- `@/*` → `./src/*` (configured in `tsconfig.json`)
- All internal imports use `@/` prefix (consistent across all files)
- Never use relative paths like `../../../lib/auth` — always use `@/lib/auth`

Example pattern (from `src/app/api/scan/route.ts`):
```typescript
import { NextResponse } from "next/server";  // Framework
import { auth } from "@/lib/auth";           // Local lib
import { prisma } from "@/lib/prisma";       // Local lib
import { scanSignals } from "@/lib/engine";  // Local lib
```

## Error Handling

**Patterns:**
- API routes: wrap in try-catch, return `NextResponse.json({ error: message }, { status: code })`
- Async handlers: catch with `catch (error)` without explicit type, use `error instanceof Error ? error.message : "..."` for message extraction
- Client-side: silent failures for non-critical operations (trades fetch, sync), explicit error state for critical flows (scan, trade execution)
- Validation: check for required fields before processing, return 400 with specific field names
- Unauthenticated: return 401 with "Unauthorized" message

Examples:
```typescript
// API routes
try {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // ... operation ...
  return NextResponse.json(result);
} catch (error) {
  console.error("Operation error:", error);
  return NextResponse.json({ error: "Operation failed" }, { status: 500 });
}

// Client-side
try {
  const res = await fetch("/api/endpoint");
  if (!res.ok) {
    const data = await res.json();
    setError(data.error || "Failed");
  }
} catch (error) {
  setError("Network error");
}
```

## Logging

**Framework:** `console.error` only

**Patterns:**
- Log errors to console with descriptive prefix: `console.error("Operation name error:", error)`
- Never log sensitive data (API keys, tokens, credentials)
- No info/debug/warning logs observed — only errors logged
- Error logging in API routes: one line per catch block with context

Examples:
```typescript
console.error("Scan proxy error:", error);
console.error("Keys save error:", error);
console.error("Trade proxy error:", error);
```

## Comments

**When to Comment:**
- API route comments: block-level comments at top of file explaining flow and purpose
- Complex logic: inline comments for non-obvious calculations (e.g., percentage math, chart transformations)
- Security-relevant code: comments explaining encryption/decryption behavior
- Data transformations: comments showing field mapping or data shape changes

**JSDoc/TSDoc:**
- Used for functions with parameters: block comments above function explaining purpose, params, and return
- Example (from `src/lib/crypto.ts`):
```typescript
/**
 * Decrypt a Fernet token back to plaintext.
 */
export function decrypt(tokenString: string): string {
```

## Function Design

**Size:** 30-80 lines typical for API handlers, 40-100 for complex components

**Parameters:**
- Destructure object parameters for clarity (see `DashboardShell({ user, children })`)
- Component props: always define interface (e.g., `SignalCardProps`) and destructure
- Avoid positional parameters when more than 2-3 args (use config object instead)

**Return Values:**
- API routes: always return `NextResponse.json(data, { status: code })`
- Components: always return JSX
- Async functions: return Promises typed explicitly
- Null/undefined: use null for "no value", undefined for optional props

Examples:
```typescript
// API handler with proper typing
export async function POST(req: Request): Promise<Response>

// Component with interface
export function SignalCard({ signal, onTrade, isTrading }: SignalCardProps)

// Typed async function
async function engineFetch<T = unknown>({ path, method, body }: EngineRequestOptions): Promise<T>
```

## Module Design

**Exports:**
- Named exports for utilities and components: `export function`, `export interface`
- Default exports for page components only (Next.js requirement)
- Never mix default and named exports from same module
- Library modules re-export initialization (e.g., `auth`, `prisma`, `handlers`)

**Barrel Files:**
- No barrel files (`index.ts`) used — all imports are explicit to specific files
- Each utility has its own file (`auth.ts`, `crypto.ts`, `engine.ts`, `prisma.ts`)
- Import directly: `import { encrypt } from "@/lib/crypto"` not `import { encrypt } from "@/lib"`

Examples:
```typescript
// ✓ Correct - named export from specific file
export function encrypt(plaintext: string): string

// ✗ Avoid - no barrel re-exports
// index.ts re-exporting from multiple files
```

---

*Convention analysis: 2026-02-26*
