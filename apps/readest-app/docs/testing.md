# Testing

Readest uses Vitest for unit and browser tests.

## Unit Tests (`pnpm test`)

Runs tests in a **jsdom** environment.

```bash
pnpm test                                       # Run all unit tests
pnpm test -- src/__tests__/utils/misc.test.ts   # Run a single file
pnpm test -- --watch                            # Watch mode
```

- **Config:** `vitest.config.mts`
- **Pattern:** `src/**/*.test.ts` (excludes `*.browser.test.ts`)
- **Environment:** jsdom
- **Use for:** Pure logic, utilities, and services that don't need real browser APIs.

## Browser Tests (`pnpm test:browser`)

Runs tests in a **real Chromium** browser via Playwright. Required for code that depends on Web Workers, SharedArrayBuffer, OPFS, or other browser-only APIs.

```bash
pnpm test:browser
```

- **Config:** `vitest.browser.config.mts`
- **Pattern:** `src/**/*.browser.test.ts`
- **Browser:** Chromium (headless, via `@vitest/browser-playwright`)
- **Use for:** WASM modules (e.g. `@tursodatabase/database-wasm`), Web Worker integration, browser-specific storage APIs.

## Test File Naming

| Suffix              | Runner              | Environment           |
| ------------------- | ------------------- | --------------------- |
| `*.test.ts`         | `pnpm test`         | jsdom                 |
| `*.browser.test.ts` | `pnpm test:browser` | Chromium (Playwright) |
