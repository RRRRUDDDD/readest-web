/**
 * Lightweight runtime logger that wraps `console.*`.
 *
 * - `error` / `warn` always print (diagnostics must survive in production).
 * - `info` / `debug` are silent in production to keep the reader hot path
 *   free of noisy console traffic.
 *
 * The implementation is deliberately small and dependency-free so it can be
 * called from any code path (workers, services, hot reader paths) without
 * pulling extra modules. If the project later adopts a heavier observability
 * stack (sentry / posthog) this is the single place to plug it in.
 */

const isProduction = (): boolean => {
  // Read at call time so tests can flip NODE_ENV across module reloads.
  return process.env['NODE_ENV'] === 'production';
};

type LogArgs = readonly unknown[];

export const logger = {
  debug(...args: LogArgs): void {
    if (isProduction()) return;
    // Prefer console.debug when present (browser DevTools) so noisy traces can
    // be filtered separately from console.log; fall back to console.log.
    const sink = (console.debug as ((...a: unknown[]) => void) | undefined) ?? console.log;
    sink(...args);
  },

  info(...args: LogArgs): void {
    if (isProduction()) return;
    const sink = (console.info as ((...a: unknown[]) => void) | undefined) ?? console.log;
    sink(...args);
  },

  warn(...args: LogArgs): void {
    console.warn(...args);
  },

  error(...args: LogArgs): void {
    console.error(...args);
  },
};

export type Logger = typeof logger;
