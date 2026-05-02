import { describe, test, expect, beforeEach, vi } from 'vitest';
import {
  getAlwaysOnTop,
  getWindowLogicalPosition,
  handleClose,
  handleOnCloseWindow,
  handleOnWindowFocus,
  handleSetAlwaysOnTop,
  handleToggleFullScreen,
  quitApp,
} from '@/utils/window';
import { eventDispatcher } from '@/utils/event';

vi.mock('@/utils/event', () => ({
  eventDispatcher: { dispatch: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('web window helpers', () => {
  test('getWindowLogicalPosition returns browser screen coordinates', async () => {
    Object.defineProperty(window, 'screenX', { value: 12, configurable: true });
    Object.defineProperty(window, 'screenY', { value: 34, configurable: true });

    await expect(getWindowLogicalPosition()).resolves.toEqual({ x: 12, y: 34 });
  });

  test('handleClose closes the browser window', async () => {
    vi.spyOn(window, 'close').mockImplementation(() => {});

    await handleClose();

    expect(window.close).toHaveBeenCalled();
  });

  test('handleOnCloseWindow registers a beforeunload listener', async () => {
    const callback = vi.fn();
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const cleanup = await handleOnCloseWindow(callback);
    const handler = addSpy.mock.calls.find(([event]) => String(event) === 'beforeunload')?.[1] as
      | (() => void)
      | undefined;
    expect(handler).toBeDefined();

    handler?.();
    expect(callback).toHaveBeenCalled();

    cleanup();
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', handler);
  });

  test('handleToggleFullScreen requests and exits fullscreen', async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      value: requestFullscreen,
      configurable: true,
    });
    Object.defineProperty(document, 'exitFullscreen', {
      value: exitFullscreen,
      configurable: true,
    });

    await handleToggleFullScreen();
    expect(requestFullscreen).toHaveBeenCalled();

    Object.defineProperty(document, 'fullscreenElement', {
      value: document.documentElement,
      configurable: true,
    });

    await handleToggleFullScreen();
    expect(exitFullscreen).toHaveBeenCalled();
  });

  test('always-on-top helpers are no-ops in the web build', async () => {
    await expect(handleSetAlwaysOnTop(true)).resolves.toBeUndefined();
    await expect(getAlwaysOnTop()).resolves.toBe(false);
  });

  test('handleOnWindowFocus registers a focus listener', async () => {
    const callback = vi.fn();
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const cleanup = await handleOnWindowFocus(callback);
    const handler = addSpy.mock.calls.find(([event]) => String(event) === 'focus')?.[1] as
      | (() => void)
      | undefined;
    expect(handler).toBeDefined();

    handler?.();
    expect(callback).toHaveBeenCalled();

    cleanup();
    expect(removeSpy).toHaveBeenCalledWith('focus', handler);
  });

  test('quitApp dispatches quit event and closes the window', async () => {
    vi.spyOn(window, 'close').mockImplementation(() => {});

    await quitApp();

    expect(eventDispatcher.dispatch).toHaveBeenCalledWith('quit-app');
    expect(window.close).toHaveBeenCalled();
  });
});
