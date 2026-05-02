import { describe, expect, it } from 'vitest';

// Direct import of the vendored foliate-js module under test.
// We exercise makeComicBook with synthetic ZipLoader-shaped inputs rather than
// constructing a real CBZ blob, to keep the assertion focused on filename
// ordering — the only piece of behavior this test cares about.
type Entry = { filename: string };
type ZipLoaderShim = {
  entries: Entry[];
  loadBlob: (name: string) => Promise<Blob>;
  getSize: (name: string) => number;
  getComment: () => Promise<string>;
};

const makeLoader = (filenames: string[]): ZipLoaderShim => ({
  entries: filenames.map((filename) => ({ filename })),
  loadBlob: async (name: string) => new Blob([name]),
  getSize: () => 0,
  // No metadata in the comment slot — exercises the "无元数据 fallback" path.
  getComment: async () => '',
});

const buildComicBook = async (filenames: string[]): Promise<{ ids: string[]; toc: string[] }> => {
  const { makeComicBook } = await import('foliate-js/comic-book.js');
  const book = await makeComicBook(
    makeLoader(filenames) as unknown as Parameters<typeof makeComicBook>[0],
    { name: 'fixture.cbz' } as unknown as File,
  );
  const sections = book.sections as Array<{ id: string }>;
  const toc = book.toc as Array<{ href: string }>;
  return {
    ids: sections.map((s) => s.id),
    toc: toc.map((t) => t.href),
  };
};

describe('makeComicBook filename ordering (no-metadata fallback)', () => {
  it('orders unpadded numeric filenames naturally instead of lexicographically', async () => {
    const { ids, toc } = await buildComicBook(['10.jpg', '2.jpg', '1.jpg', '11.jpg', '20.jpg']);
    const expected = ['1.jpg', '2.jpg', '10.jpg', '11.jpg', '20.jpg'];
    expect(ids).toEqual(expected);
    expect(toc).toEqual(expected);
  });

  it('orders multi-level chapter/page paths with embedded numbers naturally', async () => {
    const { ids } = await buildComicBook([
      'ch10/p1.jpg',
      'ch2/p1.jpg',
      'ch1/p10.jpg',
      'ch1/p2.jpg',
      'ch1/p1.jpg',
    ]);
    expect(ids).toEqual(['ch1/p1.jpg', 'ch1/p2.jpg', 'ch1/p10.jpg', 'ch2/p1.jpg', 'ch10/p1.jpg']);
  });

  it('preserves order for already zero-padded filenames', async () => {
    const padded = ['01.jpg', '02.jpg', '10.jpg', '11.jpg'];
    const { ids } = await buildComicBook([...padded].reverse());
    expect(ids).toEqual(padded);
  });

  it('preserves order for PSE-Stream-style four-digit zero-padded filenames', async () => {
    const padded = ['0000.jpg', '0001.jpg', '0009.jpg', '0010.jpg', '0099.jpg', '0100.jpg'];
    const { ids } = await buildComicBook([...padded].reverse());
    expect(ids).toEqual(padded);
  });

  it('orders CJK-prefixed numeric filenames naturally', async () => {
    const { ids } = await buildComicBook(['第10话.jpg', '第2话.jpg', '第1话.jpg']);
    expect(ids).toEqual(['第1话.jpg', '第2话.jpg', '第10话.jpg']);
  });
});
