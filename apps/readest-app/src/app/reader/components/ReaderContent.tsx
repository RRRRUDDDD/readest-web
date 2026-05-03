'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Book } from '@/types/book';
import { useEnv } from '@/context/EnvContext';
import { useSettingsStore } from '@/store/settingsStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { useReaderStore } from '@/store/readerStore';
import { useShallow } from 'zustand/react/shallow';
import { useSidebarStore } from '@/store/sidebarStore';
import { useGamepad } from '@/hooks/useGamepad';
import { useTranslation } from '@/hooks/useTranslation';
import { SystemSettings } from '@/types/settings';
import { uniqueId } from '@/utils/misc';
import { logger } from '@/utils/logger';
import { eventDispatcher } from '@/utils/event';
import { closeReaderWindowOrGoToLibrary, navigateToLibrary } from '@/utils/nav';
import { BOOK_IDS_SEPARATOR } from '@/services/constants';
import { BookDetailModal } from '@/components/metadata';

import useBooksManager from '../hooks/useBooksManager';
import useBookShortcuts from '../hooks/useBookShortcuts';
import { createCloseTransaction } from '../utils/closeTransaction';
import Spinner from '@/components/Spinner';
import SideBar from './sidebar/SideBar';
import Notebook from './notebook/Notebook';
import BooksGrid from './BooksGrid';
import SettingsDialog from '@/components/settings/SettingsDialog';

const ReaderContent: React.FC<{ ids?: string; settings: SystemSettings }> = ({ ids, settings }) => {
  const _ = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { envConfig } = useEnv();
  const { bookKeys, dismissBook, getNextBookKey } = useBooksManager();
  const { sideBarBookKey, setSideBarBookKey } = useSidebarStore();
  const { saveSettings } = useSettingsStore();
  const { getConfig, getBookData, saveConfig } = useBookDataStore();
  // Pick only the reader-store actions/getters used here. ReaderContent is
  // mounted high in the tree; without selector subscriptions it would
  // re-render on every store mutation (progress / hover / view settings).
  const { getView, setBookKeys, getViewSettings } = useReaderStore(
    useShallow((s) => ({
      getView: s.getView,
      setBookKeys: s.setBookKeys,
      getViewSettings: s.getViewSettings,
    })),
  );
  const { initViewState, getViewState, clearViewState } = useReaderStore(
    useShallow((s) => ({
      initViewState: s.initViewState,
      getViewState: s.getViewState,
      clearViewState: s.clearViewState,
    })),
  );
  const { isSettingsDialogOpen, settingsDialogBookKey } = useSettingsStore();
  const [showDetailsBook, setShowDetailsBook] = useState<Book | null>(null);
  const isInitiating = useRef(false);
  const [loading, setLoading] = useState(false);
  const [errorLoading, setErrorLoading] = useState(false);

  useBookShortcuts({ sideBarBookKey, bookKeys });
  useGamepad();

  useEffect(() => {
    if (isInitiating.current) return;
    isInitiating.current = true;

    const pathname = window.location.pathname;
    const bookIds = ids || searchParams?.get('ids') || pathname.split('/reader/')[1] || '';
    const initialIds = bookIds.split(BOOK_IDS_SEPARATOR).filter(Boolean);
    const initialBookKeys = initialIds.map((id) => `${id}-${uniqueId()}`);
    setBookKeys(initialBookKeys);
    const uniqueIds = new Set<string>();
    logger.debug('Initialize books', initialBookKeys);
    initialBookKeys.forEach((key, index) => {
      const id = key.split('-')[0]!;
      const isPrimary = !uniqueIds.has(id);
      uniqueIds.add(id);
      if (!getViewState(key)) {
        initViewState(envConfig, id, key, isPrimary).catch((error) => {
          logger.error('Error initializing book', key, error);
          setErrorLoading(true);
          eventDispatcher.dispatch('toast', {
            message: _('Unable to open book'),
            callback: async () => {
              const service = await envConfig.getAppService();
              await closeReaderWindowOrGoToLibrary(service, router);
            },
            timeout: 2000,
            type: 'error',
          });
        });
        if (index === 0) setSideBarBookKey(key);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleShowBookDetails = (event: CustomEvent) => {
      setShowDetailsBook(event.detail as Book);
      return true;
    };
    eventDispatcher.onSync('show-book-details', handleShowBookDetails);

    return () => {
      eventDispatcher.offSync('show-book-details', handleShowBookDetails);
    };
  }, []);

  const saveBookConfig = async (bookKey: string) => {
    const config = getConfig(bookKey);
    const { book } = getBookData(bookKey) || {};
    const { isPrimary } = getViewState(bookKey) || {};
    if (isPrimary && book && config) {
      const settings = useSettingsStore.getState().settings;
      eventDispatcher.dispatch('sync-book-progress', { bookKey });
      await saveConfig(envConfig, bookKey, config, settings);
    }
  };

  const saveConfigAndCloseBook = async (bookKey: string) => {
    logger.debug('Closing book', bookKey);

    try {
      getView(bookKey)?.close();
      getView(bookKey)?.remove();
    } catch {
      logger.error('Error closing book', bookKey);
    }
    eventDispatcher.dispatch('tts-stop', { bookKey });
    await saveBookConfig(bookKey);
    clearViewState(bookKey);
  };

  // Refs let the close transaction observe the latest closures + bookKeys
  // without recreating the transaction (and its in-flight slot) on every
  // render — concurrent triggers must share a single in-flight promise.
  const bookKeysRef = useRef(bookKeys);
  bookKeysRef.current = bookKeys;
  const saveConfigAndCloseBookRef = useRef(saveConfigAndCloseBook);
  saveConfigAndCloseBookRef.current = saveConfigAndCloseBook;

  const closeTx = useMemo(
    () =>
      createCloseTransaction({
        getBookKeys: () => bookKeysRef.current,
        saveConfigAndCloseBook: (key) => saveConfigAndCloseBookRef.current(key),
        saveAllSettings: async () => {
          const settings = useSettingsStore.getState().settings;
          await saveSettings(envConfig, settings);
        },
      }),
    // saveSettings + envConfig are stable (store action / context value); we
    // intentionally exclude them from deps to keep the transaction singleton.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (bookKeys && bookKeys.length > 0) {
      const settings = useSettingsStore.getState().settings;
      const lastOpenBooks = bookKeys.map((key) => key.split('-')[0]!);
      if (settings.lastOpenBooks?.toString() !== lastOpenBooks.toString()) {
        settings.lastOpenBooks = lastOpenBooks;
        saveSettings(envConfig, settings);
      }
    }

    const onBeforeUnload = () => {
      // beforeunload cannot await; fire saves best-effort. Async paths
      // (handleCloseBook / handleCloseBooksToLibrary) own the awaited path.
      closeTx.flushSync();
    };
    const onCloseEvent = () => {
      // Fire-and-forget; in-flight guard inside closeAll coalesces concurrent
      // close-reader / quit-app / beforereload events.
      void closeTx.closeAll();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    eventDispatcher.on('beforereload', onCloseEvent);
    eventDispatcher.on('close-reader', onCloseEvent);
    eventDispatcher.on('quit-app', onCloseEvent);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      eventDispatcher.off('beforereload', onCloseEvent);
      eventDispatcher.off('close-reader', onCloseEvent);
      eventDispatcher.off('quit-app', onCloseEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookKeys]);

  const navigateBackToLibrary = () => {
    navigateToLibrary(router, '', undefined, true);
  };

  const saveSettingsAndGoToLibrary = async () => {
    await saveSettings(envConfig, settings);
    navigateBackToLibrary();
  };

  const handleCloseBooksToLibrary = async () => {
    await closeTx.closeAll();
    navigateBackToLibrary();
  };

  const handleCloseBook = async (bookKey: string) => {
    await closeTx.closeOne(bookKey);
    if (sideBarBookKey === bookKey) {
      setSideBarBookKey(getNextBookKey(sideBarBookKey));
    }
    dismissBook(bookKey);
    if (bookKeys.filter((key) => key !== bookKey).length == 0) {
      await saveSettingsAndGoToLibrary();
    }
  };

  if (!bookKeys || bookKeys.length === 0) return null;
  const bookData = getBookData(bookKeys[0]!);
  const viewSettings = getViewSettings(bookKeys[0]!);
  const isReady = !!bookData?.book && !!bookData?.bookDoc && !!viewSettings;

  return (
    <ReaderContentBody
      isReady={isReady}
      loading={loading}
      errorLoading={errorLoading}
      setLoading={setLoading}
      bookKeys={bookKeys}
      onCloseBook={handleCloseBook}
      onCloseBooksToLibrary={handleCloseBooksToLibrary}
      isSettingsDialogOpen={isSettingsDialogOpen}
      settingsDialogBookKey={settingsDialogBookKey}
      showDetailsBook={showDetailsBook}
      setShowDetailsBook={setShowDetailsBook}
    />
  );
};

interface ReaderContentBodyProps {
  isReady: boolean;
  loading: boolean;
  errorLoading: boolean;
  setLoading: (v: boolean) => void;
  bookKeys: string[];
  onCloseBook: (bookKey: string) => Promise<void>;
  onCloseBooksToLibrary: () => Promise<void>;
  isSettingsDialogOpen: boolean;
  settingsDialogBookKey: string;
  showDetailsBook: Book | null;
  setShowDetailsBook: (book: Book | null) => void;
}

// Split into a body component so we can use a `useEffect` to schedule the
// loading-spinner delay timer. Previously the parent scheduled a `setTimeout`
// inside its render branch — which fired a fresh timer on every re-render and
// continued to fire after unmount. Pulling the not-ready branch into a
// dedicated effect with a cleanup eliminates both leaks.
const ReaderContentBody: React.FC<ReaderContentBodyProps> = ({
  isReady,
  loading,
  errorLoading,
  setLoading,
  bookKeys,
  onCloseBook,
  onCloseBooksToLibrary,
  isSettingsDialogOpen,
  settingsDialogBookKey,
  showDetailsBook,
  setShowDetailsBook,
}) => {
  useEffect(() => {
    if (isReady) return;
    const timer = setTimeout(() => setLoading(true), 200);
    return () => clearTimeout(timer);
  }, [isReady, setLoading]);

  if (!isReady) {
    return loading && !errorLoading ? (
      <div className='hero hero-content full-height'>
        <Spinner loading={true} />
      </div>
    ) : null;
  }

  return (
    <div className='reader-content full-height flex'>
      <SideBar />
      <BooksGrid
        bookKeys={bookKeys}
        onCloseBook={onCloseBook}
        onGoToLibrary={onCloseBooksToLibrary}
      />
      {isSettingsDialogOpen && <SettingsDialog bookKey={settingsDialogBookKey} />}
      <Notebook />
      {showDetailsBook && (
        <BookDetailModal
          isOpen={!!showDetailsBook}
          book={showDetailsBook}
          onClose={() => setShowDetailsBook(null)}
        />
      )}
    </div>
  );
};

export default ReaderContent;
