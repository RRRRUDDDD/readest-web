import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withResource, type AsyncDisposable } from '@/utils/withResource';

const makeResource = (closeImpl?: () => void | Promise<void>) => {
  const close = vi.fn(closeImpl ?? (() => {}));
  return { close } as AsyncDisposable & { close: ReturnType<typeof vi.fn> };
};

describe('withResource', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // logger.warn delegates straight to console.warn — spy on the sink so we
    // can assert close-error reporting without coupling to logger internals.
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs use on the acquired resource and returns its value', async () => {
    const resource = makeResource();
    const result = await withResource(
      () => resource,
      (r) => {
        expect(r).toBe(resource);
        return 42;
      },
    );
    expect(result).toBe(42);
  });

  it('calls close exactly once after use succeeds', async () => {
    const resource = makeResource();
    await withResource(
      () => resource,
      async () => 'ok',
    );
    expect(resource.close).toHaveBeenCalledTimes(1);
  });

  it('propagates the use error and still closes the resource', async () => {
    const resource = makeResource();
    const useError = new Error('use boom');
    await expect(
      withResource(
        () => resource,
        async () => {
          throw useError;
        },
      ),
    ).rejects.toBe(useError);
    expect(resource.close).toHaveBeenCalledTimes(1);
  });

  it('swallows close errors when use succeeded and warns via logger', async () => {
    const closeError = new Error('close boom');
    const resource = makeResource(() => {
      throw closeError;
    });
    const result = await withResource(
      () => resource,
      async () => 'ok',
    );
    expect(result).toBe('ok');
    expect(warnSpy).toHaveBeenCalledWith('withResource: close failed', closeError);
  });

  it('prefers the use error when both use and close throw', async () => {
    const useError = new Error('use boom');
    const closeError = new Error('close boom');
    const resource = makeResource(() => {
      throw closeError;
    });
    await expect(
      withResource(
        () => resource,
        async () => {
          throw useError;
        },
      ),
    ).rejects.toBe(useError);
    expect(warnSpy).toHaveBeenCalledWith('withResource: close failed', closeError);
  });

  it('does not call use or close if acquire fails', async () => {
    const acquireError = new Error('acquire boom');
    const useFn = vi.fn();
    const acquireFn = vi.fn(() => {
      throw acquireError;
    });
    await expect(withResource(acquireFn as () => AsyncDisposable, useFn)).rejects.toBe(
      acquireError,
    );
    expect(useFn).not.toHaveBeenCalled();
  });

  it('awaits a synchronous close return value', async () => {
    const resource = makeResource(() => undefined);
    await expect(
      withResource(
        () => resource,
        async () => 'ok',
      ),
    ).resolves.toBe('ok');
    expect(resource.close).toHaveBeenCalledTimes(1);
  });
});
