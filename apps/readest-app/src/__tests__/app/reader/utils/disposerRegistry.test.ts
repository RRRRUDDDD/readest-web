import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDisposerRegistry } from '../../../../app/reader/utils/disposerRegistry';

describe('createDisposerRegistry', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // logger.warn delegates straight to console.warn — spy on the sink so we
    // can assert disposer-error reporting without coupling to logger internals.
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs all disposers in LIFO order', () => {
    const calls: string[] = [];
    const registry = createDisposerRegistry();
    registry.add(() => calls.push('a'));
    registry.add(() => calls.push('b'));
    registry.add(() => calls.push('c'));

    registry.dispose();

    expect(calls).toEqual(['c', 'b', 'a']);
  });

  it('continues disposing when one disposer throws', () => {
    const calls: string[] = [];
    const boom = new Error('disposer boom');
    const registry = createDisposerRegistry();
    registry.add(() => calls.push('a'));
    registry.add(() => {
      throw boom;
    });
    registry.add(() => calls.push('c'));

    registry.dispose();

    // LIFO: c → boom → a. boom must not abort the loop.
    expect(calls).toEqual(['c', 'a']);
    expect(warnSpy).toHaveBeenCalledWith('disposerRegistry: disposer threw', boom);
  });

  it('is idempotent — second dispose() is a no-op', () => {
    const fn = vi.fn();
    const registry = createDisposerRegistry();
    registry.add(fn);

    registry.dispose();
    registry.dispose();

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('dispose on empty registry does not throw', () => {
    const registry = createDisposerRegistry();
    expect(() => registry.dispose()).not.toThrow();
  });

  it('disposers added during dispose() run on next dispose()', () => {
    const calls: string[] = [];
    const registry = createDisposerRegistry();
    const lateDisposer = vi.fn(() => calls.push('late'));

    registry.add(() => {
      calls.push('a');
      // Add another disposer while dispose() is iterating. With the
      // snapshot-and-clear implementation, the late disposer must NOT run
      // in this dispose() pass — it accumulates and runs on the next one.
      registry.add(lateDisposer);
    });

    registry.dispose();
    expect(calls).toEqual(['a']);
    expect(lateDisposer).not.toHaveBeenCalled();

    registry.dispose();
    expect(calls).toEqual(['a', 'late']);
    expect(lateDisposer).toHaveBeenCalledTimes(1);
  });

  it('add after dispose works for a fresh cycle', () => {
    const calls: string[] = [];
    const registry = createDisposerRegistry();
    registry.add(() => calls.push('first'));
    registry.dispose();

    registry.add(() => calls.push('second'));
    registry.dispose();

    expect(calls).toEqual(['first', 'second']);
  });

  it('logger.warn receives the original Error reference', () => {
    const originalError = new Error('exact-instance');
    const registry = createDisposerRegistry();
    registry.add(() => {
      throw originalError;
    });

    registry.dispose();

    // Spy on console.warn directly: assert the SECOND argument is the same
    // Error reference — not a wrapped or stringified copy.
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const callArgs = warnSpy.mock.calls[0]!;
    expect(callArgs[1]).toBe(originalError);
  });
});
