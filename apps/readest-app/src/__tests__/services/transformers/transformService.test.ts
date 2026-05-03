import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { Transformer, TransformContext } from '@/services/transformers/types';
import type { ViewSettings } from '@/types/book';

// We mock the transformer registry so we can inject controlled sync/async
// transformers and assert how transformContent stitches them together.
const mockTransformers: Transformer[] = [];

vi.mock('@/services/transformers', () => ({
  get availableTransformers() {
    return mockTransformers;
  },
}));

beforeEach(() => {
  mockTransformers.length = 0;
});

function makeCtx(overrides: Partial<TransformContext> = {}): TransformContext {
  return {
    bookKey: 'test-book',
    viewSettings: {} as ViewSettings,
    userLocale: 'en',
    isFixedLayout: false,
    content: '',
    transformers: [],
    ...overrides,
  };
}

describe('transformContent sync-fast-path', () => {
  test('chains synchronous transformers and returns their accumulated output', async () => {
    const sync1: Transformer = {
      name: 'sync1',
      transform: (ctx) => ctx.content + '-A',
    };
    const sync2: Transformer = {
      name: 'sync2',
      transform: (ctx) => ctx.content + '-B',
    };
    const sync3: Transformer = {
      name: 'sync3',
      transform: (ctx) => ctx.content + '-C',
    };
    mockTransformers.push(sync1, sync2, sync3);

    const { transformContent } = await import('@/services/transformService');
    const result = await transformContent(
      makeCtx({ content: 'X', transformers: ['sync1', 'sync2', 'sync3'] }),
    );
    expect(result).toBe('X-A-B-C');
  });

  test('does not introduce a microtask hop between consecutive sync transformers', async () => {
    // If transformContent `await`s a synchronous transformer's result, the
    // chain yields between transformers. The orderingMarker probe runs as a
    // queued microtask AFTER the current task; if any transformer ran AFTER
    // the marker, transformContent must have yielded.
    const callOrder: string[] = [];
    const sync1: Transformer = {
      name: 'sync1',
      transform: (ctx) => {
        callOrder.push('sync1');
        return ctx.content + '-A';
      },
    };
    const sync2: Transformer = {
      name: 'sync2',
      transform: (ctx) => {
        callOrder.push('sync2');
        return ctx.content + '-B';
      },
    };
    mockTransformers.push(sync1, sync2);

    const { transformContent } = await import('@/services/transformService');
    const promise = transformContent(makeCtx({ content: 'X', transformers: ['sync1', 'sync2'] }));
    // Right after kicking off transformContent, both sync transformers should
    // have already run synchronously — no `await` between them.
    expect(callOrder).toEqual(['sync1', 'sync2']);
    await promise;
  });

  test('still awaits transformers that return a real Promise', async () => {
    const sync1: Transformer = {
      name: 'sync',
      transform: (ctx) => ctx.content + '-S',
    };
    const async1: Transformer = {
      name: 'async',
      transform: async (ctx) => {
        await Promise.resolve();
        return ctx.content + '-A';
      },
    };
    const sync2: Transformer = {
      name: 'sync2',
      transform: (ctx) => ctx.content + '-T',
    };
    mockTransformers.push(sync1, async1, sync2);

    const { transformContent } = await import('@/services/transformService');
    const result = await transformContent(
      makeCtx({ content: 'X', transformers: ['sync', 'async', 'sync2'] }),
    );
    expect(result).toBe('X-S-A-T');
  });

  test('synchronous transformer throwing does not abort the chain', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing: Transformer = {
      name: 'failing',
      transform: () => {
        throw new Error('sync boom');
      },
    };
    const ok: Transformer = {
      name: 'ok',
      transform: (ctx) => ctx.content + '-OK',
    };
    mockTransformers.push(failing, ok);

    const { transformContent } = await import('@/services/transformService');
    const result = await transformContent(
      makeCtx({ content: 'X', transformers: ['failing', 'ok'] }),
    );

    expect(result).toBe('X-OK');
    expect(consoleWarn).toHaveBeenCalledWith(expect.stringContaining('failing'), expect.any(Error));
    consoleWarn.mockRestore();
  });

  test('asynchronous transformer rejecting does not abort the chain', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failing: Transformer = {
      name: 'failing-async',
      transform: async () => {
        throw new Error('async boom');
      },
    };
    const ok: Transformer = {
      name: 'ok',
      transform: (ctx) => ctx.content + '-OK',
    };
    mockTransformers.push(failing, ok);

    const { transformContent } = await import('@/services/transformService');
    const result = await transformContent(
      makeCtx({ content: 'X', transformers: ['failing-async', 'ok'] }),
    );

    expect(result).toBe('X-OK');
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('failing-async'),
      expect.any(Error),
    );
    consoleWarn.mockRestore();
  });

  test('skips unknown transformer names without throwing', async () => {
    const sync: Transformer = {
      name: 'sync',
      transform: (ctx) => ctx.content + '-S',
    };
    mockTransformers.push(sync);

    const { transformContent } = await import('@/services/transformService');
    const result = await transformContent(
      makeCtx({ content: 'X', transformers: ['sync', 'does-not-exist'] }),
    );
    expect(result).toBe('X-S');
  });
});

describe('availableTransformers sync/async classification', () => {
  // The earlier `vi.mock('@/services/transformers', ...)` swaps the registry
  // for our test doubles. To inspect the real registry we go through
  // vi.importActual so the mock is bypassed for this describe block.
  const loadReal = async () => {
    const mod =
      await vi.importActual<typeof import('@/services/transformers')>('@/services/transformers');
    return mod.availableTransformers;
  };

  test('synchronous transformers are declared as plain functions (not async)', async () => {
    const real = await loadReal();
    const syncNames = [
      'punctuation',
      'footnote',
      'language',
      'whitespace',
      'sanitizer',
      'proofread',
      'warichu',
    ];
    for (const name of syncNames) {
      const transformer = real.find((t) => t.name === name);
      expect(transformer, `transformer ${name} not found`).toBeDefined();
      // Async functions report constructor name 'AsyncFunction'; plain
      // functions report 'Function'. Sync transformers must NOT be
      // AsyncFunction so transformContent can short-circuit microtask hops.
      expect(transformer!.transform.constructor.name).toBe('Function');
    }
  });

  test('asynchronous transformers stay declared async', async () => {
    const real = await loadReal();
    const asyncNames = ['style', 'simplecc'];
    for (const name of asyncNames) {
      const transformer = real.find((t) => t.name === name);
      expect(transformer, `transformer ${name} not found`).toBeDefined();
      expect(transformer!.transform.constructor.name).toBe('AsyncFunction');
    }
  });
});
