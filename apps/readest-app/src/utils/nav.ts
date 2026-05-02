import { redirect, useRouter } from 'next/navigation';
import { BOOK_IDS_SEPARATOR } from '@/services/constants';
import { AppService } from '@/types/system';

const readerUrl = (bookIds: string[], queryParams?: string) => {
  const ids = bookIds.join(BOOK_IDS_SEPARATOR);
  const params = new URLSearchParams(queryParams || '');
  params.set('ids', ids);
  return `/reader?${params.toString()}`;
};

export const showReaderWindow = (_appService: AppService, bookIds: string[]) => {
  window.open(readerUrl(bookIds), '_blank', 'noopener,noreferrer');
};

export const showLibraryWindow = (_appService: AppService, filenames: string[]) => {
  const params = new URLSearchParams();
  filenames.forEach((filename) => params.append('file', filename));
  window.open(`/library?${params.toString()}`, '_blank', 'noopener,noreferrer');
};

export const ensureMainLibraryWindow = async (_appService: AppService) => {};

export const navigateToReader = (
  router: ReturnType<typeof useRouter>,
  bookIds: string[],
  queryParams?: string,
  navOptions?: { scroll?: boolean },
) => {
  router.push(readerUrl(bookIds, queryParams), navOptions);
};

export const navigateToLogin = (router: ReturnType<typeof useRouter>) => {
  const pathname = window.location.pathname;
  const search = window.location.search;
  const currentPath = pathname !== '/auth' ? pathname + search : '/';
  router.push(`/auth?redirect=${encodeURIComponent(currentPath)}`);
};

export const navigateToProfile = (router: ReturnType<typeof useRouter>) => {
  router.push('/user');
};

export const navigateToLibrary = (
  router: ReturnType<typeof useRouter>,
  queryParams?: string,
  navOptions?: { scroll?: boolean },
  navBack?: boolean,
) => {
  const lastLibraryParams =
    typeof window !== 'undefined' ? sessionStorage.getItem('lastLibraryParams') : null;
  if (navBack && lastLibraryParams) queryParams = lastLibraryParams;
  router.replace(`/library${queryParams ? `?${queryParams}` : ''}`, navOptions);
};

export const closeReaderWindowOrGoToLibrary = async (
  _appService: AppService | null,
  router: ReturnType<typeof useRouter>,
) => {
  navigateToLibrary(router, '', undefined, true);
};

export const redirectToLibrary = () => {
  redirect('/library');
};

export const navigateToResetPassword = (router: ReturnType<typeof useRouter>) => {
  const pathname = window.location.pathname;
  const search = window.location.search;
  const currentPath = pathname !== '/auth' ? pathname + search : '/';
  router.push(`/auth/recovery?redirect=${encodeURIComponent(currentPath)}`);
};

export const navigateToUpdatePassword = (router: ReturnType<typeof useRouter>) => {
  const pathname = window.location.pathname;
  const search = window.location.search;
  const currentPath = pathname !== '/auth' ? pathname + search : '/';
  router.push(`/auth/update?redirect=${encodeURIComponent(currentPath)}`);
};
