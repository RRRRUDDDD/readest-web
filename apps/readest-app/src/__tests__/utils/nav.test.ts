import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('@/services/constants', () => ({
  BOOK_IDS_SEPARATOR: '+',
}));

import { redirect } from 'next/navigation';
import {
  navigateToReader,
  navigateToLogin,
  navigateToProfile,
  navigateToLibrary,
  navigateToResetPassword,
  navigateToUpdatePassword,
  redirectToLibrary,
  showReaderWindow,
  showLibraryWindow,
  ensureMainLibraryWindow,
  closeReaderWindowOrGoToLibrary,
} from '@/utils/nav';

function mockRouter() {
  return {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, 'location', {
    value: { pathname: '/library', search: '?q=test' },
    writable: true,
  });
  vi.spyOn(window, 'open').mockImplementation(() => null);
  sessionStorage.clear();
});

describe('navigateToReader', () => {
  test('uses query-param reader URLs for the web app', () => {
    const router = mockRouter();
    navigateToReader(router, ['book1', 'book2']);

    expect(router.push).toHaveBeenCalledWith('/reader?ids=book1%2Bbook2', undefined);
  });

  test('appends additional query params', () => {
    const router = mockRouter();
    navigateToReader(router, ['book1'], 'view=scroll');

    expect(router.push).toHaveBeenCalledWith('/reader?view=scroll&ids=book1', undefined);
  });

  test('passes navOptions through', () => {
    const router = mockRouter();
    navigateToReader(router, ['book1'], undefined, { scroll: false });

    expect(router.push).toHaveBeenCalledWith('/reader?ids=book1', { scroll: false });
  });
});

describe('window helpers', () => {
  test('showReaderWindow opens a new browser tab', () => {
    showReaderWindow({} as never, ['book1', 'book2']);

    expect(window.open).toHaveBeenCalledWith(
      '/reader?ids=book1%2Bbook2',
      '_blank',
      'noopener,noreferrer',
    );
  });

  test('showLibraryWindow opens a library tab with file params', () => {
    showLibraryWindow({} as never, ['file1.epub', 'file2.epub']);

    expect(window.open).toHaveBeenCalledWith(
      '/library?file=file1.epub&file=file2.epub',
      '_blank',
      'noopener,noreferrer',
    );
  });

  test('ensureMainLibraryWindow is a no-op in the web build', async () => {
    await expect(ensureMainLibraryWindow({} as never)).resolves.toBeUndefined();
  });
});

describe('navigateToLogin', () => {
  test('navigates to /auth with redirect from current path', () => {
    const router = mockRouter();
    navigateToLogin(router);

    expect(router.push).toHaveBeenCalledWith('/auth?redirect=%2Flibrary%3Fq%3Dtest');
  });

  test('uses / as redirect when already on /auth', () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/auth', search: '' },
      writable: true,
    });

    const router = mockRouter();
    navigateToLogin(router);

    expect(router.push).toHaveBeenCalledWith('/auth?redirect=%2F');
  });
});

describe('navigateToProfile', () => {
  test('navigates to /user', () => {
    const router = mockRouter();
    navigateToProfile(router);

    expect(router.push).toHaveBeenCalledWith('/user');
  });
});

describe('navigateToLibrary', () => {
  test('replaces to /library without params by default', () => {
    const router = mockRouter();
    navigateToLibrary(router);

    expect(router.replace).toHaveBeenCalledWith('/library', undefined);
  });

  test('replaces to /library with query params', () => {
    const router = mockRouter();
    navigateToLibrary(router, 'sort=title');

    expect(router.replace).toHaveBeenCalledWith('/library?sort=title', undefined);
  });

  test('passes navOptions through', () => {
    const router = mockRouter();
    navigateToLibrary(router, undefined, { scroll: false });

    expect(router.replace).toHaveBeenCalledWith('/library', { scroll: false });
  });

  test('uses lastLibraryParams from sessionStorage when navBack=true', () => {
    sessionStorage.setItem('lastLibraryParams', 'sort=author&view=list');

    const router = mockRouter();
    navigateToLibrary(router, undefined, undefined, true);

    expect(router.replace).toHaveBeenCalledWith('/library?sort=author&view=list', undefined);
  });
});

describe('closeReaderWindowOrGoToLibrary', () => {
  test('navigates the current web view to the library', async () => {
    const router = mockRouter();
    await closeReaderWindowOrGoToLibrary({} as never, router);

    expect(router.replace).toHaveBeenCalledWith('/library', undefined);
  });

  test('uses saved library params when navigating back', async () => {
    sessionStorage.setItem('lastLibraryParams', 'sort=author');

    const router = mockRouter();
    await closeReaderWindowOrGoToLibrary(null, router);

    expect(router.replace).toHaveBeenCalledWith('/library?sort=author', undefined);
  });
});

describe('redirectToLibrary', () => {
  test('calls redirect to /library', () => {
    redirectToLibrary();
    expect(redirect).toHaveBeenCalledWith('/library');
  });
});

describe('password navigation', () => {
  test('navigateToResetPassword preserves redirect', () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/settings', search: '' },
      writable: true,
    });

    const router = mockRouter();
    navigateToResetPassword(router);

    expect(router.push).toHaveBeenCalledWith('/auth/recovery?redirect=%2Fsettings');
  });

  test('navigateToUpdatePassword preserves redirect', () => {
    Object.defineProperty(window, 'location', {
      value: { pathname: '/user', search: '?tab=security' },
      writable: true,
    });

    const router = mockRouter();
    navigateToUpdatePassword(router);

    expect(router.push).toHaveBeenCalledWith('/auth/update?redirect=%2Fuser%3Ftab%3Dsecurity');
  });
});
