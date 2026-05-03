/**
 * Close-book transaction helper.
 *
 * Centralizes the "save progress, close view, persist settings" sequence so
 * caller paths can `await` a single promise instead of fire-and-forget
 * scattering across `handleCloseBook` / `handleCloseBooksToLibrary` /
 * `beforeunload`.
 *
 * Reentrancy: concurrent `closeAll` invocations share the same in-flight
 * promise. This avoids racing two close paths (e.g. user clicks "back to
 * library" while a `quit-app` event also fires) into double-saving the same
 * config or interleaving with view teardown.
 *
 * `flushSync` is the best-effort path used in `beforeunload` where the page
 * may unload before promises resolve. It triggers the same saves but
 * intentionally does not return a promise — the page is leaving anyway.
 */

export interface CloseTransactionDeps {
  /** Returns the current set of open book keys. Re-evaluated on every call. */
  getBookKeys: () => readonly string[];
  /** Saves progress and tears down the view for one book. May reject. */
  saveConfigAndCloseBook: (bookKey: string) => Promise<void>;
  /** Persists app-level settings (lastOpenBooks, etc). May reject. */
  saveAllSettings: () => Promise<void>;
}

export interface CloseTransaction {
  /** Save + close every currently-open book, then persist settings. */
  closeAll: () => Promise<void>;
  /** Save + close a single book without touching app-level settings. */
  closeOne: (bookKey: string) => Promise<void>;
  /** Best-effort fire-and-forget for `beforeunload`-style hooks. */
  flushSync: () => void;
}

export const createCloseTransaction = (deps: CloseTransactionDeps): CloseTransaction => {
  let inflight: Promise<void> | null = null;

  const runCloseAll = async (): Promise<void> => {
    const keys = [...deps.getBookKeys()];
    let closeError: unknown;
    // Run per-book saves in parallel, but always reach the final settings save
    // even if one rejects. We surface the first error to the caller after
    // settings have been persisted.
    const results = await Promise.allSettled(keys.map((key) => deps.saveConfigAndCloseBook(key)));
    for (const r of results) {
      if (r.status === 'rejected') {
        closeError = r.reason;
        break;
      }
    }
    await deps.saveAllSettings();
    if (closeError !== undefined) throw closeError;
  };

  return {
    closeAll(): Promise<void> {
      if (inflight) return inflight;
      const p = runCloseAll().finally(() => {
        if (inflight === p) inflight = null;
      });
      inflight = p;
      return p;
    },

    closeOne(bookKey: string): Promise<void> {
      return deps.saveConfigAndCloseBook(bookKey);
    },

    flushSync(): void {
      const keys = [...deps.getBookKeys()];
      // Intentionally drop the returned promises; the page is unloading.
      for (const key of keys) {
        void deps.saveConfigAndCloseBook(key);
      }
      void deps.saveAllSettings();
    },
  };
};
