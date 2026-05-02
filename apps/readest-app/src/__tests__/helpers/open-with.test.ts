import { describe, test, expect, beforeEach } from 'vitest';

import { parseOpenWithFiles } from '@/helpers/openWith';

beforeEach(() => {
  delete window.OPEN_WITH_FILES;
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search: '' },
    writable: true,
  });
});

describe('parseOpenWithFiles', () => {
  test('returns an empty array when no web open-with source exists', async () => {
    const result = await parseOpenWithFiles(null);

    expect(result).toEqual([]);
  });

  test('parses file params from URL search', async () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '?file=book1.epub&file=book2.epub' },
      writable: true,
    });

    const result = await parseOpenWithFiles(null);

    expect(result).toEqual(['book1.epub', 'book2.epub']);
  });

  test('uses window.OPEN_WITH_FILES when no URL params are present', async () => {
    window.OPEN_WITH_FILES = ['/path/to/book.epub'];

    const result = await parseOpenWithFiles(null);

    expect(result).toEqual(['/path/to/book.epub']);
  });

  test('prefers URL params over window.OPEN_WITH_FILES', async () => {
    Object.defineProperty(window, 'location', {
      value: { ...window.location, search: '?file=url-book.epub' },
      writable: true,
    });
    window.OPEN_WITH_FILES = ['/path/to/window-book.epub'];

    const result = await parseOpenWithFiles(null);

    expect(result).toEqual(['url-book.epub']);
  });
});
