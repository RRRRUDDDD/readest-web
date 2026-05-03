/**
 * Monotonic-counter guard for async sync responses.
 *
 * Use case: a hook fires a remote `push` whose response settles asynchronously.
 * If the user types again before the first response returns, applying the
 * stale response would clobber the newer state. This helper tags each
 * outgoing operation with a ticket number; only the latest ticket is
 * considered "current".
 *
 * Usage:
 *   const guard = createSyncSequenceGuard();
 *   const ticket = guard.next();
 *   const data = await fetchRemote();
 *   if (guard.isCurrent(ticket)) applyResponse(data);
 *
 * On unmount, call `cancelAll()` from a useEffect cleanup so any in-flight
 * ticket — including the latest — is invalidated.
 */

export interface SyncSequenceGuard {
  /** Allocate a new ticket; supersedes all previous tickets. */
  next: () => number;
  /** True iff `ticket` is the most recently-issued, un-cancelled ticket. */
  isCurrent: (ticket: number) => boolean;
  /** Invalidate every outstanding ticket; subsequent `next()` calls work normally. */
  cancelAll: () => void;
}

export const createSyncSequenceGuard = (): SyncSequenceGuard => {
  let counter = 0;
  let current = 0;

  return {
    next(): number {
      counter += 1;
      current = counter;
      return counter;
    },
    isCurrent(ticket: number): boolean {
      return ticket === current && ticket > 0;
    },
    cancelAll(): void {
      // Setting current to 0 invalidates every existing ticket (which is >= 1)
      // without disturbing the monotonic counter.
      current = 0;
    },
  };
};
