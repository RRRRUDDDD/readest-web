import { describe, expect, it } from 'vitest';

import { createLoadSessionGuard } from '../../../../app/reader/utils/loadSession';

describe('createLoadSessionGuard', () => {
  it('next() returns strictly increasing tickets per key', () => {
    const guard = createLoadSessionGuard();
    const t1 = guard.next('book-a');
    const t2 = guard.next('book-a');
    const t3 = guard.next('book-a');
    // Tickets come from a single monotonic counter so a stale ticket from
    // before a cancel can never collide with a fresh one. We only assert
    // strict monotonicity, not the literal sequence 1/2/3 — the counter
    // is implementation-private and may advance via other keys.
    expect(t2).toBeGreaterThan(t1);
    expect(t3).toBeGreaterThan(t2);
  });

  it('tickets are independent across keys', () => {
    const guard = createLoadSessionGuard();
    const a1 = guard.next('book-a');
    const b1 = guard.next('book-b');
    const a2 = guard.next('book-a');
    // Both keys share the global counter, but isCurrent is per-key.
    expect(guard.isCurrent('book-a', a1)).toBe(false);
    expect(guard.isCurrent('book-b', b1)).toBe(true);
    expect(guard.isCurrent('book-a', a2)).toBe(true);
  });

  it('isCurrent is true only for the most recent ticket of a key', () => {
    const guard = createLoadSessionGuard();
    const t1 = guard.next('book-a');
    expect(guard.isCurrent('book-a', t1)).toBe(true);
    const t2 = guard.next('book-a');
    expect(guard.isCurrent('book-a', t1)).toBe(false);
    expect(guard.isCurrent('book-a', t2)).toBe(true);
  });

  it('cancel(key) invalidates every outstanding ticket for that key', () => {
    const guard = createLoadSessionGuard();
    const t = guard.next('book-a');
    expect(guard.isCurrent('book-a', t)).toBe(true);
    guard.cancel('book-a');
    expect(guard.isCurrent('book-a', t)).toBe(false);
  });

  it('cancel(key) leaves tickets for other keys untouched', () => {
    const guard = createLoadSessionGuard();
    const a = guard.next('book-a');
    const b = guard.next('book-b');
    guard.cancel('book-a');
    expect(guard.isCurrent('book-a', a)).toBe(false);
    expect(guard.isCurrent('book-b', b)).toBe(true);
  });

  it('next(key) after cancel(key) issues a strictly larger ticket', () => {
    const guard = createLoadSessionGuard();
    const stale = guard.next('book-a');
    guard.next('book-a'); // intermediate noise
    guard.cancel('book-a');
    const fresh = guard.next('book-a');
    // Crucial invariant: the new ticket must NOT collide with any
    // previously-issued ticket for the key — otherwise a stale in-flight
    // init holding the old ticket would be misidentified as current.
    expect(fresh).toBeGreaterThan(stale);
    expect(guard.isCurrent('book-a', stale)).toBe(false);
    expect(guard.isCurrent('book-a', fresh)).toBe(true);
  });

  it('cancelAll() invalidates tickets across every key', () => {
    const guard = createLoadSessionGuard();
    const a = guard.next('book-a');
    const b = guard.next('book-b');
    expect(guard.isCurrent('book-a', a)).toBe(true);
    expect(guard.isCurrent('book-b', b)).toBe(true);
    guard.cancelAll();
    expect(guard.isCurrent('book-a', a)).toBe(false);
    expect(guard.isCurrent('book-b', b)).toBe(false);
  });

  it('typical race scenario: stale init for a key is dropped after cancel', async () => {
    const guard = createLoadSessionGuard();
    const applied: string[] = [];

    const slowInit = async (key: string, ticket: number, delay: number, label: string) => {
      await new Promise((r) => setTimeout(r, delay));
      // The init body is gated: only the latest ticket gets to commit.
      if (guard.isCurrent(key, ticket)) applied.push(label);
    };

    const t1 = guard.next('book-a');
    const p1 = slowInit('book-a', t1, 50, 'old');
    // User closes the book before the slow init returns.
    guard.cancel('book-a');
    // User reopens — fresh ticket.
    const t2 = guard.next('book-a');
    const p2 = slowInit('book-a', t2, 5, 'fresh');

    await Promise.all([p1, p2]);
    expect(applied).toEqual(['fresh']);
  });
});
