/**
 * Disposer registry — collects synchronous cleanup functions and runs them
 * all when `dispose()` is called.
 *
 * Use case: viewer / iframe / long-press observer setup paths register
 * dozens of `removeEventListener` / `clearTimeout` / `MutationObserver.
 * disconnect` calls. Without a centralized registry these cleanups are
 * scattered across `useEffect` returns, ad-hoc closures and forgotten
 * branches — see `.claude/plan/b2-b3-codex-fixes.md` P1-④ for the
 * concrete leaks (`addLongPressListeners` never removes its listeners,
 * `detail.doc.isEventListenersAdded` doc listeners never get removed,
 * etc).
 *
 * Semantics:
 * - Disposers are called in **LIFO** order (last-registered first). This
 *   mirrors stack-style resource ownership: when a later disposer depends
 *   on a resource owned by an earlier one, releasing the later resource
 *   first keeps things safe.
 * - A disposer that throws does NOT abort the loop — its error is logged
 *   via `logger.warn` and the remaining disposers still run. This matches
 *   the project's `transformService.ts` console.warn convention: cleanup
 *   errors are typically "already closed" noise that must not block the
 *   teardown of other resources.
 * - `dispose()` is idempotent. Internally we snapshot the disposer array
 *   and clear the field BEFORE running, so:
 *   - A second `dispose()` call is a no-op (snapshot is empty).
 *   - Disposers added DURING `dispose()` (rare but possible — a disposer
 *     that re-registers cleanup for newly-spawned work) accumulate on the
 *     freshly-cleared array and run on the NEXT `dispose()`. They do not
 *     run in the current pass and cannot cause infinite recursion.
 * - After `dispose()`, the registry is reusable: `add()` followed by
 *   another `dispose()` works for a fresh cycle.
 *
 * Disposers are intentionally synchronous (`() => void`). React effect
 * cleanup is also synchronous (the React runtime does not await the
 * returned function), and every cleanup target in this codebase
 * (`removeEventListener`, `clearTimeout`, `MutationObserver.disconnect`)
 * is synchronous. If a caller truly needs async cleanup, they should
 * fire-and-forget inside the disposer:
 *
 *     registry.add(() => { void asyncCleanup(); });
 */

import { logger } from '@/utils/logger';

export type Disposer = () => void;

export interface DisposerRegistry {
  add(disposer: Disposer): void;
  dispose(): void;
}

export const createDisposerRegistry = (): DisposerRegistry => {
  let disposers: Disposer[] = [];

  return {
    add(disposer: Disposer): void {
      disposers.push(disposer);
    },
    dispose(): void {
      // Snapshot + clear BEFORE iterating. Two reasons:
      // 1. Idempotency: a second dispose() finds an empty array and no-ops.
      // 2. Re-entrancy: a disposer that calls add() during this dispose()
      //    pushes onto the cleared field, not the snapshot we are
      //    iterating — so we cannot loop forever and the late disposer
      //    runs on the NEXT dispose().
      const pending = disposers;
      disposers = [];
      for (let i = pending.length - 1; i >= 0; i--) {
        try {
          pending[i]!();
        } catch (e) {
          logger.warn('disposerRegistry: disposer threw', e);
        }
      }
    },
  };
};
