/**
 * Per-key monotonic-counter guard for cancellable async sessions.
 *
 * Use case: `readerStore.initViewState` is a long async chain crossing many
 * awaits (fs.openFile, DocumentLoader.open, computeBookNav, …). If the
 * user closes or switches books mid-load, `clearViewState` removes the
 * `viewStates[key]` record — but the old init's later `set()` calls still
 * write back, producing ghost views, error states clobbering fresh loads,
 * and leaked BookData (see `.claude/plan/b2-b3-codex-fixes.md` P0-②).
 *
 * The guard hands out a per-key ticket on `next(key)`. Each `set()` in the
 * load chain is gated by `isCurrent(key, ticket)`. When `clearViewState`
 * fires, it calls `cancel(key)`, invalidating every outstanding ticket for
 * that key so the in-flight init body becomes a no-op.
 *
 * Modeled after `syncSequenceGuard` (single global counter), but with
 * per-key state so concurrent loads of different books don't share — and
 * thus don't accidentally invalidate — each other's tickets.
 *
 * Semantics:
 * - Tickets are drawn from a single monotonic counter that NEVER resets.
 *   This is critical: after `cancel(key)` followed by a fresh `next(key)`,
 *   the new ticket must NOT collide with any cancelled ticket — otherwise
 *   a stale in-flight init would think it is current. Per-key counter
 *   resets break this invariant; a global counter does not.
 * - `isCurrent(key, ticket)` is true iff the per-key entry equals the
 *   ticket — i.e. this ticket is the latest one issued for that key AND
 *   the key has not been cancelled since.
 * - `cancel(key)` clears the per-key entry. Subsequent `isCurrent(key, t)`
 *   returns false for every previously-issued ticket. The next `next(key)`
 *   issues a new ticket from the still-monotonic global counter, so the
 *   new session is unambiguously distinct from cancelled ones.
 * - `cancelAll()` clears every entry but does NOT reset the global
 *   counter, so previously-issued tickets stay invalid forever.
 */

export interface LoadSessionGuard {
  /** Allocate a fresh ticket for `key`; supersedes any previous ticket. */
  next: (key: string) => number;
  /** True iff `ticket` is the latest non-cancelled ticket for `key`. */
  isCurrent: (key: string, ticket: number) => boolean;
  /** Invalidate every outstanding ticket for `key`. */
  cancel: (key: string) => void;
  /** Invalidate tickets across every key (mass-teardown). */
  cancelAll: () => void;
}

export const createLoadSessionGuard = (): LoadSessionGuard => {
  let counter = 0;
  const sessions = new Map<string, number>();

  return {
    next(key: string): number {
      counter += 1;
      sessions.set(key, counter);
      return counter;
    },
    isCurrent(key: string, ticket: number): boolean {
      return sessions.get(key) === ticket && ticket > 0;
    },
    cancel(key: string): void {
      // Delete so isCurrent(key, anyTicket) returns false. The global
      // counter does NOT reset — so the next `next(key)` produces a
      // strictly larger ticket, keeping cancelled tickets invalid.
      sessions.delete(key);
    },
    cancelAll(): void {
      sessions.clear();
    },
  };
};
