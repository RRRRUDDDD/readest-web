import { describe, expect, it } from 'vitest';

import { createSyncSequenceGuard } from '../../../../app/reader/utils/syncSequenceGuard';

describe('createSyncSequenceGuard', () => {
  it('accepts the latest sequence and rejects all earlier ones', () => {
    const guard = createSyncSequenceGuard();
    const a = guard.next();
    const b = guard.next();
    expect(guard.isCurrent(a)).toBe(false);
    expect(guard.isCurrent(b)).toBe(true);
  });

  it('isCurrent returns true only for the most recent ticket', () => {
    const guard = createSyncSequenceGuard();
    const t1 = guard.next();
    expect(guard.isCurrent(t1)).toBe(true);
    const t2 = guard.next();
    expect(guard.isCurrent(t1)).toBe(false);
    expect(guard.isCurrent(t2)).toBe(true);
  });

  it('cancelAll invalidates all outstanding tickets', () => {
    const guard = createSyncSequenceGuard();
    const t = guard.next();
    expect(guard.isCurrent(t)).toBe(true);
    guard.cancelAll();
    expect(guard.isCurrent(t)).toBe(false);
  });

  it('after cancelAll the next ticket is current again', () => {
    const guard = createSyncSequenceGuard();
    guard.next();
    guard.cancelAll();
    const t = guard.next();
    expect(guard.isCurrent(t)).toBe(true);
  });

  it('typical race scenario: stale response is dropped', async () => {
    const guard = createSyncSequenceGuard();
    const applied: number[] = [];

    const slowResponse = async (ticket: number, delay: number, value: number) => {
      await new Promise((r) => setTimeout(r, delay));
      if (guard.isCurrent(ticket)) applied.push(value);
    };

    const t1 = guard.next();
    const p1 = slowResponse(t1, 50, 1);
    // user issues a newer push before t1 returns
    const t2 = guard.next();
    const p2 = slowResponse(t2, 5, 2);

    await Promise.all([p1, p2]);
    expect(applied).toEqual([2]);
  });
});
