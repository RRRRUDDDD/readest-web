import { AppService } from '@/types/system';

declare global {
  interface Window {
    OPEN_WITH_FILES?: string[] | null;
  }
}

const parseWindowOpenWithFiles = () => {
  const params = new URLSearchParams(window.location.search);
  const files = params.getAll('file');
  return files.length > 0 ? files : (window.OPEN_WITH_FILES ?? []);
};

export const parseOpenWithFiles = async (_appService: AppService | null) => {
  return parseWindowOpenWithFiles();
};
