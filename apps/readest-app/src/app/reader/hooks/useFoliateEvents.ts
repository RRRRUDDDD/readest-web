import { useEffect } from 'react';
import { FoliateView } from '@/types/view';
import { createDisposerRegistry } from '../utils/disposerRegistry';

type FoliateEventHandler = {
  onLoad?: (event: Event) => void;
  onStabilized?: (event: Event) => void;
  onRelocate?: (event: Event) => void;
  onLinkClick?: (event: Event) => void;
  onRendererRelocate?: (event: Event) => void;
  onCreateOverlay?: (event: Event) => void;
  onDrawAnnotation?: (event: Event) => void;
  onShowAnnotation?: (event: Event) => void;
};

export const useFoliateEvents = (view: FoliateView | null, handlers?: FoliateEventHandler) => {
  const onLoad = handlers?.onLoad;
  const onStabilized = handlers?.onStabilized;
  const onRelocate = handlers?.onRelocate;
  const onLinkClick = handlers?.onLinkClick;
  const onRendererRelocate = handlers?.onRendererRelocate;
  const onCreateOverlay = handlers?.onCreateOverlay;
  const onDrawAnnotation = handlers?.onDrawAnnotation;
  const onShowAnnotation = handlers?.onShowAnnotation;

  useEffect(() => {
    if (!view) return;
    // Collect every removeEventListener via a disposerRegistry so the
    // cleanup is symmetric-by-construction. Previously the add and
    // remove blocks were two parallel hand-written lists — easy to drift
    // when adding a new handler. See B2-2 (disposerRegistry) and B2-5.
    const registry = createDisposerRegistry();

    if (onLoad) {
      view.addEventListener('load', onLoad);
      registry.add(() => view.removeEventListener('load', onLoad));
    }
    if (onStabilized) {
      view.renderer.addEventListener('stabilized', onStabilized);
      registry.add(() => view.renderer.removeEventListener('stabilized', onStabilized));
    }
    if (onRelocate) {
      view.addEventListener('relocate', onRelocate);
      registry.add(() => view.removeEventListener('relocate', onRelocate));
    }
    if (onLinkClick) {
      view.addEventListener('link', onLinkClick);
      registry.add(() => view.removeEventListener('link', onLinkClick));
    }
    if (onRendererRelocate) {
      view.renderer.addEventListener('relocate', onRendererRelocate);
      registry.add(() => view.renderer.removeEventListener('relocate', onRendererRelocate));
    }
    if (onCreateOverlay) {
      view.addEventListener('create-overlay', onCreateOverlay);
      registry.add(() => view.removeEventListener('create-overlay', onCreateOverlay));
    }
    if (onDrawAnnotation) {
      view.addEventListener('draw-annotation', onDrawAnnotation);
      registry.add(() => view.removeEventListener('draw-annotation', onDrawAnnotation));
    }
    if (onShowAnnotation) {
      view.addEventListener('show-annotation', onShowAnnotation);
      registry.add(() => view.removeEventListener('show-annotation', onShowAnnotation));
    }

    return () => registry.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
};
