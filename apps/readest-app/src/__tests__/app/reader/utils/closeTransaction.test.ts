import { describe, expect, it, vi } from 'vitest';

import { createCloseTransaction } from '../../../../app/reader/utils/closeTransaction';

const flushMicrotasks = async () => {
  // Two ticks to settle awaited Promise.all + finally block.
  for (let i = 0; i < 4; i++) await Promise.resolve();
};

describe('createCloseTransaction', () => {
  it('closeOne awaits saveConfigAndCloseBook before resolving', async () => {
    let saved = false;
    const saveConfigAndCloseBook = vi.fn(async () => {
      await Promise.resolve();
      saved = true;
    });

    const tx = createCloseTransaction({
      getBookKeys: () => ['a-1'],
      saveConfigAndCloseBook,
      saveAllSettings: vi.fn(async () => {}),
    });

    const promise = tx.closeOne('a-1');
    expect(saved).toBe(false);
    await promise;
    expect(saved).toBe(true);
    expect(saveConfigAndCloseBook).toHaveBeenCalledWith('a-1');
  });

  it('closeAll awaits all per-book saves and a final settings save', async () => {
    const saveOrder: string[] = [];
    const saveConfigAndCloseBook = vi.fn(async (key: string) => {
      await Promise.resolve();
      saveOrder.push(`save:${key}`);
    });
    const saveAllSettings = vi.fn(async () => {
      await Promise.resolve();
      saveOrder.push('settings');
    });

    const tx = createCloseTransaction({
      getBookKeys: () => ['a-1', 'b-2'],
      saveConfigAndCloseBook,
      saveAllSettings,
    });

    await tx.closeAll();
    expect(saveOrder).toEqual(expect.arrayContaining(['save:a-1', 'save:b-2']));
    expect(saveOrder[saveOrder.length - 1]).toBe('settings');
    expect(saveConfigAndCloseBook).toHaveBeenCalledTimes(2);
  });

  it('concurrent closeAll calls share a single in-flight transaction', async () => {
    const saveConfigAndCloseBook = vi.fn(async () => {
      await Promise.resolve();
    });
    const saveAllSettings = vi.fn(async () => {
      await Promise.resolve();
    });

    const tx = createCloseTransaction({
      getBookKeys: () => ['a-1'],
      saveConfigAndCloseBook,
      saveAllSettings,
    });

    const p1 = tx.closeAll();
    const p2 = tx.closeAll();
    expect(p1).toBe(p2); // same promise reference — coalesced
    await Promise.all([p1, p2]);
    expect(saveConfigAndCloseBook).toHaveBeenCalledTimes(1);
    expect(saveAllSettings).toHaveBeenCalledTimes(1);
  });

  it('a failed save in one book does not skip the settings save', async () => {
    const saveConfigAndCloseBook = vi.fn(async (key: string) => {
      if (key === 'a-1') throw new Error('boom');
    });
    const saveAllSettings = vi.fn(async () => {});

    const tx = createCloseTransaction({
      getBookKeys: () => ['a-1', 'b-2'],
      saveConfigAndCloseBook,
      saveAllSettings,
    });

    // closeAll is allowed to reject, but the settings save must have run anyway.
    await tx.closeAll().catch(() => {});
    expect(saveAllSettings).toHaveBeenCalled();
  });

  it('after a closeAll completes, a new closeAll runs again (in-flight cleared)', async () => {
    const saveConfigAndCloseBook = vi.fn(async () => {
      await Promise.resolve();
    });
    const saveAllSettings = vi.fn(async () => {});

    const tx = createCloseTransaction({
      getBookKeys: () => ['a-1'],
      saveConfigAndCloseBook,
      saveAllSettings,
    });

    await tx.closeAll();
    await tx.closeAll();
    expect(saveConfigAndCloseBook).toHaveBeenCalledTimes(2);
    expect(saveAllSettings).toHaveBeenCalledTimes(2);
  });

  it('flushSync invokes saveConfigAndCloseBook for each book without awaiting (best-effort beforeunload)', async () => {
    const saveConfigAndCloseBook = vi.fn(async () => {
      await Promise.resolve();
    });
    const saveAllSettings = vi.fn(async () => {});

    const tx = createCloseTransaction({
      getBookKeys: () => ['a-1', 'b-2', 'c-3'],
      saveConfigAndCloseBook,
      saveAllSettings,
    });

    // flushSync: trigger saves but do not block — used for beforeunload.
    tx.flushSync();
    expect(saveConfigAndCloseBook).toHaveBeenCalledTimes(3);

    await flushMicrotasks();
  });
});
