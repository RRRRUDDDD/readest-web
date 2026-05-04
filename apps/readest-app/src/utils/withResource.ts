/**
 * Try/finally helper that guarantees `close()` runs after a resource is used.
 *
 * Use case: `DocumentLoader` / `ZipReader` / any open file handle that must
 * be released even when the body of the operation throws. Centralizing the
 * pattern avoids ad-hoc try/finally that historically forgot to close on
 * the failure path (see `.claude/plan/b2-b3-codex-fixes.md` P1-⑧).
 *
 * Error semantics (kept aligned with `transformService.ts` console.warn
 * convention):
 * - `use` throws → `close()` still runs, then the original `use` error
 *   propagates unchanged.
 * - `close` throws while `use` succeeded → `use`'s return value is
 *   returned; the close error is logged via `logger.warn`.
 * - `close` and `use` both throw → the `use` error propagates (close
 *   error must not mask the actual failure); the close error is logged
 *   via `logger.warn`.
 * - `acquire` throws → `use` is never called and `close` is never called
 *   (the resource was never produced); the acquire error propagates.
 *
 * The interface is named `AsyncDisposable` and uses `close()` rather than
 * the TC39 stage-3 `Symbol.asyncDispose` because the project targets
 * ES2022 and existing Web APIs (ReadableStream, FileReader, …) already
 * use `close()` as the canonical disposal hook.
 */

import { logger } from './logger';

export interface AsyncDisposable {
  close(): Promise<void> | void;
}

export const withResource = async <T extends AsyncDisposable, R>(
  acquire: () => Promise<T> | T,
  use: (resource: T) => Promise<R> | R,
): Promise<R> => {
  const resource = await acquire();
  try {
    return await use(resource);
  } finally {
    try {
      await resource.close();
    } catch (closeError) {
      logger.warn('withResource: close failed', closeError);
    }
  }
};
