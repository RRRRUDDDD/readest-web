import { create } from 'zustand';
import { SystemSettings } from '@/types/settings';
import { Book, BookConfig, BookNote } from '@/types/book';
import { EnvConfigType } from '@/services/environment';
import { BookDoc } from '@/libs/document';
import { ClosableFile } from '@/utils/file';
import { logger } from '@/utils/logger';
import { useLibraryStore } from './libraryStore';

export interface BookData {
  /* Persistent data shared with different views of the same book */
  id: string;
  book: Book | null;
  file: File | null;
  config: BookConfig | null;
  bookDoc: BookDoc | null;
  isFixedLayout: boolean;
  /**
   * Optional resource-release hook produced by `DocumentLoader.open()`.
   * Released by `clearBookData` when the last view referencing this id
   * is removed (see B2-3: P1-⑧). Optional so existing test fixtures and
   * mock BookData literals don't need updating.
   */
  dispose?: () => Promise<void>;
}

interface BookDataState {
  booksData: { [id: string]: BookData };
  getConfig: (key: string | null) => BookConfig | null;
  setConfig: (key: string, partialConfig: Partial<BookConfig>) => void;
  saveConfig: (
    envConfig: EnvConfigType,
    bookKey: string,
    config: BookConfig,
    settings: SystemSettings,
  ) => Promise<void>;
  updateBooknotes: (key: string, booknotes: BookNote[]) => BookConfig | undefined;
  getBookData: (keyOrId: string) => BookData | null;
  clearBookData: (keyOrId: string) => void;
}

/**
 * Fire-and-forget resource release for a BookData record.
 *
 * Two independent release steps run sequentially so a failure in one
 * does not skip the other:
 * 1. `data.dispose()` — releases resources owned by `DocumentLoader.open()`
 *    (currently the ZipReader for EPUB/CBZ/FBZ formats).
 * 2. `(file as ClosableFile).close()` — releases the underlying File
 *    handle when the file is a Tauri-side RemoteFile or any other
 *    ClosableFile implementation.
 *
 * Errors are logged via `logger.warn` and never thrown — the calling
 * `clearBookData` is synchronous on purpose (React unmount cleanup).
 */
const releaseBookDataResources = async (data: BookData): Promise<void> => {
  if (data.dispose) {
    try {
      await data.dispose();
    } catch (e) {
      logger.warn('clearBookData: dispose failed', e);
    }
  }
  const closableFile = data.file as Partial<ClosableFile> | null;
  if (closableFile?.close) {
    try {
      await closableFile.close();
    } catch (e) {
      logger.warn('clearBookData: file close failed', e);
    }
  }
};

export const useBookDataStore = create<BookDataState>((set, get) => ({
  booksData: {},
  getBookData: (keyOrId: string) => {
    const id = keyOrId.split('-')[0]!;
    return get().booksData[id] || null;
  },
  clearBookData: (keyOrId: string) => {
    const id = keyOrId.split('-')[0]!;
    const data = get().booksData[id];
    set((state) => {
      const newBooksData = { ...state.booksData };
      delete newBooksData[id];
      return {
        booksData: newBooksData,
      };
    });
    // Resource release runs in the background — clearBookData itself stays
    // synchronous because it's called from React unmount paths that don't
    // await anything. Errors are logged but never propagate.
    if (data) {
      void releaseBookDataResources(data);
    }
  },
  getConfig: (key: string | null) => {
    if (!key) return null;
    const id = key.split('-')[0]!;
    return get().booksData[id]?.config || null;
  },
  setConfig: (key: string, partialConfig: Partial<BookConfig>) => {
    set((state: BookDataState) => {
      const id = key.split('-')[0]!;
      const config = state.booksData[id]?.config;
      if (!config) {
        console.warn('No config found for book', id);
        return state;
      }
      return {
        booksData: {
          ...state.booksData,
          [id]: {
            ...state.booksData[id]!,
            config: { ...config, ...partialConfig },
          },
        },
      };
    });
  },
  saveConfig: async (
    envConfig: EnvConfigType,
    bookKey: string,
    config: BookConfig,
    settings: SystemSettings,
  ) => {
    const appService = await envConfig.getAppService();
    const { library, hashIndex, setLibrary } = useLibraryStore.getState();
    const hash = bookKey.split('-')[0]!;
    const idx = hashIndex.get(hash);
    if (idx === undefined) return;

    // Immutably move the book to the front of the library with updated
    // progress and timestamps. We do NOT mutate the existing book object or
    // the existing library array — Zustand subscribers see fresh references
    // and the visibleLibrary cache stays in sync via setLibrary's full update.
    const original = library[idx]!;
    const updatedBook: Book = {
      ...original,
      progress: config.progress,
      updatedAt: Date.now(),
      downloadedAt: original.downloadedAt || Date.now(),
    };
    const newLibrary = [updatedBook, ...library.slice(0, idx), ...library.slice(idx + 1)];
    setLibrary(newLibrary);

    config.updatedAt = Date.now();
    await appService.saveBookConfig(updatedBook, config, settings);
    await appService.saveLibraryBooks(useLibraryStore.getState().library);
  },
  updateBooknotes: (key: string, booknotes: BookNote[]) => {
    let updatedConfig: BookConfig | undefined;
    set((state) => {
      const id = key.split('-')[0]!;
      const book = state.booksData[id];
      if (!book) return state;
      const dedupedBooknotes = Array.from(
        new Map(booknotes.map((item) => [`${item.id}-${item.type}-${item.cfi}`, item])).values(),
      );
      updatedConfig = {
        ...book.config,
        updatedAt: Date.now(),
        booknotes: dedupedBooknotes,
      };
      return {
        booksData: {
          ...state.booksData,
          [id]: {
            ...book,
            config: {
              ...book.config,
              updatedAt: Date.now(),
              booknotes: dedupedBooknotes,
            },
          },
        },
      };
    });
    return updatedConfig;
  },
}));
