import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { DocumentLoader } from '@/libs/document';

// Polyfill CSS.escape for jsdom (matches book-nav-cache.test.ts setup)
if (typeof globalThis['CSS'] === 'undefined') {
  (globalThis as Record<string, unknown>)['CSS'] = {
    escape: (s: string) => s.replace(/([^\w-])/g, '\\$1'),
  };
}

if (!customElements.get('foliate-paginator')) {
  customElements.define(
    'foliate-paginator',
    class extends HTMLElement {
      override setAttribute() {}
      override addEventListener() {}
      open() {}
    },
  );
}

vi.mock('foliate-js/paginator.js', () => ({}));
// pdf.js dynamically loads its worker via a path that doesn't resolve in
// jsdom. Stub makePDF so the PDF noop test below can exercise the dispose
// contract without booting the real worker.
vi.mock('foliate-js/pdf.js', () => ({
  makePDF: vi.fn().mockResolvedValue({ metadata: {}, sections: [] }),
}));

const openEpubFixture = async (name = 'sample-alice.epub') => {
  const epubPath = resolve(__dirname, `../fixtures/data/${name}`);
  const buffer = readFileSync(epubPath);
  const file = new File([buffer], name, { type: 'application/epub+zip' });
  const loader = new DocumentLoader(file);
  return loader.open();
};

const openPdfFixture = async (name = 'sample-alice.pdf') => {
  const pdfPath = resolve(__dirname, `../fixtures/data/${name}`);
  const buffer = readFileSync(pdfPath);
  const file = new File([buffer], name, { type: 'application/pdf' });
  const loader = new DocumentLoader(file);
  return loader.open();
};

describe('DocumentLoader.open() — dispose contract', () => {
  it('returns a dispose function on the open() result', async () => {
    const result = await openEpubFixture();
    expect(typeof result.dispose).toBe('function');
  });

  it('dispose() resolves without throwing for a zip-based format (EPUB)', async () => {
    const result = await openEpubFixture();
    await expect(result.dispose()).resolves.toBeUndefined();
  });

  it('dispose() is idempotent — second call is a no-op', async () => {
    const result = await openEpubFixture();
    await result.dispose();
    // The second invocation must not throw and must not attempt to close
    // an already-closed ZipReader (which would surface as an error).
    await expect(result.dispose()).resolves.toBeUndefined();
  });

  it('dispose() resolves cleanly for non-zip formats (PDF noop path)', async () => {
    const result = await openPdfFixture();
    expect(typeof result.dispose).toBe('function');
    await expect(result.dispose()).resolves.toBeUndefined();
  });
});
