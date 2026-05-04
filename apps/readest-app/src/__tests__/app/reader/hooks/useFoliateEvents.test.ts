import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useFoliateEvents } from '../../../../app/reader/hooks/useFoliateEvents';

/**
 * Build a stub FoliateView with addEventListener/removeEventListener spies
 * on both the view and its renderer (some events go to the renderer).
 */
const makeView = () => {
  const view = {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    renderer: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  };
  return view;
};

describe('useFoliateEvents', () => {
  it('subscribes provided handlers to the view event types', () => {
    const view = makeView();
    const onLoad = vi.fn();
    const onRelocate = vi.fn();
    renderHook(() => useFoliateEvents(view as never, { onLoad, onRelocate }));

    const addedTypes = view.addEventListener.mock.calls.map((c) => c[0]);
    expect(addedTypes).toContain('load');
    expect(addedTypes).toContain('relocate');
  });

  it('routes onStabilized + onRendererRelocate to view.renderer (not view)', () => {
    const view = makeView();
    const onStabilized = vi.fn();
    const onRendererRelocate = vi.fn();
    renderHook(() =>
      useFoliateEvents(view as never, {
        onStabilized,
        onRendererRelocate,
      }),
    );

    // These two go to the renderer, not the view itself.
    const rendererTypes = view.renderer.addEventListener.mock.calls.map((c) => c[0]);
    expect(rendererTypes).toContain('stabilized');
    expect(rendererTypes).toContain('relocate');
  });

  it('unsubscribes all handlers when the view changes', () => {
    const view1 = makeView();
    const view2 = makeView();
    const onLoad = vi.fn();
    const onRelocate = vi.fn();

    const { rerender } = renderHook(
      ({ view }) => useFoliateEvents(view as never, { onLoad, onRelocate }),
      { initialProps: { view: view1 } },
    );

    rerender({ view: view2 });

    // Every handler that was subscribed to view1 must be unsubscribed.
    const removedTypes = view1.removeEventListener.mock.calls.map((c) => c[0]);
    expect(removedTypes).toContain('load');
    expect(removedTypes).toContain('relocate');
  });

  it('unsubscribes when the hook unmounts', () => {
    const view = makeView();
    const onLoad = vi.fn();
    const { unmount } = renderHook(() => useFoliateEvents(view as never, { onLoad }));
    unmount();
    const removedTypes = view.removeEventListener.mock.calls.map((c) => c[0]);
    expect(removedTypes).toContain('load');
  });

  it('does nothing when view is null', () => {
    const onLoad = vi.fn();
    expect(() => {
      renderHook(() => useFoliateEvents(null, { onLoad }));
    }).not.toThrow();
    // No view available to register against — no spy calls expected.
    expect(onLoad).not.toHaveBeenCalled();
  });
});
