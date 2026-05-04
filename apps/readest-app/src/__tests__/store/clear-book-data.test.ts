import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/services/environment', () => ({
  isTauriAppPlatform: () => false,
}));

vi.mock('@/utils/md5', () => ({
  md5Fingerprint: (value: string) => `md5_${value}`,
}));

import { useBookDataStore } from '@/store/bookDataStore';
import type { BookData } from '@/store/bookDataStore';

describe('useBookDataStore.clearBookData — resource release', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    useBookDataStore.setState({ booksData: {} });
    // logger.warn delegates straight to console.warn; spy on the sink.
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls BookData.dispose when a record is cleared', async () => {
    const dispose = vi.fn().mockResolvedValue(undefined);
    const data: BookData = {
      id: 'abc',
      book: null,
      file: null,
      config: null,
      bookDoc: null,
      isFixedLayout: false,
      dispose,
    };
    useBookDataStore.setState({ booksData: { abc: data } });

    useBookDataStore.getState().clearBookData('abc');

    // The store mutation is synchronous.
    expect(useBookDataStore.getState().booksData['abc']).toBeUndefined();

    // Resource release is fire-and-forget; flush microtasks before asserting.
    await new Promise((r) => setTimeout(r, 0));
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('calls close() on data.file when the file implements ClosableFile', async () => {
    const fileClose = vi.fn().mockResolvedValue(undefined);
    // Construct a File that also exposes close() — the runtime check in
    // bookDataStore is `'close' in data.file`, not an instanceof guard.
    const closableFile = Object.assign(new File([], 'book.epub'), {
      open: vi.fn().mockResolvedValue(undefined),
      close: fileClose,
    });
    const data: BookData = {
      id: 'def',
      book: null,
      file: closableFile,
      config: null,
      bookDoc: null,
      isFixedLayout: false,
    };
    useBookDataStore.setState({ booksData: { def: data } });

    useBookDataStore.getState().clearBookData('def');

    await new Promise((r) => setTimeout(r, 0));
    expect(fileClose).toHaveBeenCalledTimes(1);
  });

  it('logs but does not throw when dispose() fails', async () => {
    const disposeError = new Error('dispose boom');
    const data: BookData = {
      id: 'ghi',
      book: null,
      file: null,
      config: null,
      bookDoc: null,
      isFixedLayout: false,
      dispose: vi.fn().mockRejectedValue(disposeError),
    };
    useBookDataStore.setState({ booksData: { ghi: data } });

    // Synchronous call must NOT throw, even though dispose() will reject.
    expect(() => useBookDataStore.getState().clearBookData('ghi')).not.toThrow();

    // Wait for the fire-and-forget release path to settle.
    await new Promise((r) => setTimeout(r, 0));
    expect(warnSpy).toHaveBeenCalledWith('clearBookData: dispose failed', disposeError);
  });
});
