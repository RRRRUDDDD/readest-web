// used to execute a callback when the "active" state of the current window changes.
// On web, "active" means "is visible".

import { useEffect, useRef } from 'react';

export type ActiveCallback = (isActive: boolean) => void;

type Cleanup = () => void;
async function activeChangedOther(onChange: ActiveCallback): Promise<Cleanup> {
  const handler = () => onChange(document.visibilityState === 'visible');

  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}

export function useWindowActiveChanged(callback: ActiveCallback) {
  const onActiveChanged = useRef<ActiveCallback>(callback);

  useEffect(() => {
    onActiveChanged.current = callback;
  }, [callback]);

  useEffect(() => {
    let isAlive = true;
    let unsub: Cleanup | undefined;
    const onChange = (isActive: boolean) => {
      onActiveChanged.current?.(isActive);
    };

    activeChangedOther(onChange)
      .then((cleanup) => {
        if (isAlive) {
          unsub = cleanup;
        } else {
          // component was already unmounted, just clean up immediately
          cleanup();
        }
      })
      .catch((e) => {
        console.error('Could not listen for window active changes', e);
      });

    return () => {
      isAlive = false;
      unsub?.();
    };
  }, []);
}
