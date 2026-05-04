import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the same transitive imports as reader-store.test.ts so the readerStore
// module can load in jsdom without pulling Tauri/HTTP/OPDS code paths.
vi.mock('@/store/settingsStore', () => {
  const { create } = require('zustand');
  return {
    useSettingsStore: create(() => ({ settings: {} })),
  };
});

vi.mock('@/store/libraryStore', () => {
  const { create } = require('zustand');
  return {
    useLibraryStore: create(() => ({
      library: [],
      hashIndex: new Map(),
      setLibrary: vi.fn(),
      getBookByHash: vi.fn(),
      updateBookProgress: vi.fn(),
      rebuildHashIndex: vi.fn(),
    })),
  };
});

vi.mock('@/utils/misc', () => ({
  uniqueId: vi.fn(() => 'mock-uid-123'),
}));

vi.mock('@/services/nav', () => ({ updateToc: vi.fn() }));
vi.mock('@/utils/book', () => ({
  formatTitle: vi.fn((t: string) => t),
  getMetadataHash: vi.fn(() => 'hash'),
  getPrimaryLanguage: vi.fn(() => 'en'),
}));
vi.mock('@/utils/path', () => ({
  getBaseFilename: vi.fn((n: string) => n),
}));
vi.mock('@/services/constants', () => ({
  SUPPORTED_LANGNAMES: {},
}));
vi.mock('@/libs/document', () => ({
  DocumentLoader: vi.fn(),
}));
vi.mock('@/services/opds/pseStream', () => ({
  isPseStreamFileName: () => false,
  openPseStreamBook: vi.fn(),
  parsePseStreamFileName: vi.fn(),
}));

// Crucially we do NOT mock `@/store/bookDataStore` — the test needs to
// observe its real `clearBookData` behavior so we can assert that
// `booksData[id]` actually gets removed when the last view goes away.

import { useReaderStore } from '@/store/readerStore';
import { useBookDataStore } from '@/store/bookDataStore';
import type { BookData } from '@/store/bookDataStore';

const makeViewState = (key: string) =>
  ({
    key,
    view: null,
    viewerKey: '',
    isPrimary: false,
    loading: false,
    inited: false,
    error: null,
    progress: null,
    ribbonVisible: false,
    ttsEnabled: false,
    syncing: false,
    gridInsets: null,
    previewMode: false,
    viewSettings: null,
  }) as unknown as ReturnType<typeof useReaderStore.getState>['viewStates'][string];

const makeBookData = (id: string): BookData => ({
  id,
  book: null,
  file: null,
  config: null,
  bookDoc: null,
  isFixedLayout: false,
});

describe('useReaderStore.clearViewState — last-view detection', () => {
  beforeEach(() => {
    useReaderStore.setState({ viewStates: {} });
    useBookDataStore.setState({ booksData: {} });
  });

  it('triggers clearBookData when the last view for an id is removed', () => {
    const id = 'aaa';
    const key = `${id}-1`;
    useReaderStore.setState({ viewStates: { [key]: makeViewState(key) } });
    useBookDataStore.setState({ booksData: { [id]: makeBookData(id) } });

    useReaderStore.getState().clearViewState(key);

    // ViewState removed — and because no sibling view shares the id,
    // BookData is also released.
    expect(useReaderStore.getState().viewStates[key]).toBeUndefined();
    expect(useBookDataStore.getState().booksData[id]).toBeUndefined();
  });

  it('does NOT trigger clearBookData while another view shares the id', () => {
    const id = 'bbb';
    const key1 = `${id}-1`;
    const key2 = `${id}-2`;
    useReaderStore.setState({
      viewStates: {
        [key1]: makeViewState(key1),
        [key2]: makeViewState(key2),
      },
    });
    useBookDataStore.setState({ booksData: { [id]: makeBookData(id) } });

    // Remove the first of two sibling views.
    useReaderStore.getState().clearViewState(key1);

    expect(useReaderStore.getState().viewStates[key1]).toBeUndefined();
    expect(useReaderStore.getState().viewStates[key2]).toBeDefined();
    // BookData still alive — a sibling view (`-2`) is still open.
    expect(useBookDataStore.getState().booksData[id]).toBeDefined();

    // Remove the second view → BookData must now release.
    useReaderStore.getState().clearViewState(key2);
    expect(useBookDataStore.getState().booksData[id]).toBeUndefined();
  });
});
