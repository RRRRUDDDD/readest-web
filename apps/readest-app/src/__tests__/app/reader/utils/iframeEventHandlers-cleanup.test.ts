import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { addLongPressListeners } from '../../../../app/reader/utils/iframeEventHandlers';

/**
 * Build a minimal `Document`-like host with one `<img>` so addLongPressListeners
 * has something to attach to. We track the actual addEventListener /
 * removeEventListener calls via spies on the element.
 */
const makeHostDoc = () => {
  const html = `<!DOCTYPE html><html><body><img src="x" /></body></html>`;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const img = doc.querySelector('img')!;
  const addSpy = vi.spyOn(img, 'addEventListener');
  const removeSpy = vi.spyOn(img, 'removeEventListener');
  return { doc, img, addSpy, removeSpy };
};

describe('addLongPressListeners — cleanup contract', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('cleanup disconnects the MutationObserver', () => {
    // Spy directly on MutationObserver.prototype so the production code's
    // `new MutationObserver(...)` still constructs successfully.
    const disconnectSpy = vi.spyOn(MutationObserver.prototype, 'disconnect');

    const { doc } = makeHostDoc();
    const cleanup = addLongPressListeners('book-x', doc);
    cleanup();

    expect(disconnectSpy).toHaveBeenCalled();
  });

  it('cleanup clears all pending press timers', () => {
    const { doc, img } = makeHostDoc();
    const cleanup = addLongPressListeners('book-x', doc);

    // Fire mousedown to start a press timer.
    const event = new MouseEvent('mousedown', { clientX: 10, clientY: 10, bubbles: true });
    img.dispatchEvent(event);

    // The timer should be pending (longPress fires after 500ms).
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    cleanup();
    // At least one clearTimeout must have run for the press timer.
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('cleanup removes element listeners that were registered', () => {
    const { doc, img, addSpy, removeSpy } = makeHostDoc();
    const cleanup = addLongPressListeners('book-x', doc);

    // The internal addLongPressListeners(el) is invoked synchronously via
    // querySelectorAll over the doc, so the img has been wired up.
    const addedTypes = addSpy.mock.calls.map((c) => c[0]);
    expect(addedTypes).toContain('mousedown');
    expect(addedTypes).toContain('touchstart');

    cleanup();

    // Every type that was added should also be removed.
    const removedTypes = removeSpy.mock.calls.map((c) => c[0]);
    for (const type of new Set(addedTypes)) {
      expect(removedTypes).toContain(type);
    }
    // The data-long-press-added attribute should also be cleared so the
    // element can be re-registered after a new viewer setup.
    expect(img.hasAttribute('data-long-press-added')).toBe(false);
  });

  it('cleanup is safe when no elements were ever registered', () => {
    // Empty doc — no img, no table, no svg with image.
    const doc = new DOMParser().parseFromString(
      '<!DOCTYPE html><html><body></body></html>',
      'text/html',
    );
    const cleanup = addLongPressListeners('book-x', doc);
    expect(() => cleanup()).not.toThrow();
  });

  it('cleanup is safe when called twice', () => {
    const { doc } = makeHostDoc();
    const cleanup = addLongPressListeners('book-x', doc);
    cleanup();
    expect(() => cleanup()).not.toThrow();
  });
});
