import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// We'll dynamically re-import logger with different NODE_ENV to test gating.
// Each test resets the module registry.
async function importLogger() {
  vi.resetModules();
  return (await import('../../utils/logger')).logger;
}

describe('logger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('debug is silent in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const logger = await importLogger();
    logger.debug('hello', { a: 1 });
    expect(logSpy).not.toHaveBeenCalled();
    expect(debugSpy).not.toHaveBeenCalled();
  });

  it('debug prints in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const logger = await importLogger();
    logger.debug('hello');
    // In development, debug routes to console.debug (or console.log fallback)
    const totalCalls = debugSpy.mock.calls.length + logSpy.mock.calls.length;
    expect(totalCalls).toBeGreaterThan(0);
  });

  it('error always prints regardless of env', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const logger = await importLogger();
    logger.error('boom');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('warn always prints regardless of env', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const logger = await importLogger();
    logger.warn('careful');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('info is silent in production but prints in development', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    let logger = await importLogger();
    logger.info('boot');
    expect(infoSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();

    vi.stubEnv('NODE_ENV', 'development');
    logger = await importLogger();
    logger.info('boot');
    const totalCalls = infoSpy.mock.calls.length + logSpy.mock.calls.length;
    expect(totalCalls).toBeGreaterThan(0);
  });

  it('forwards multiple arguments unchanged to console', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const logger = await importLogger();
    const obj = { x: 1 };
    logger.error('msg', obj, 42);
    expect(errorSpy).toHaveBeenCalledWith('msg', obj, 42);
  });
});
