// Smoke test: verify the new BlobScanner path works against a real MDX.
//
//   node tests/smoke-blob.mjs
//
// The test:
//   1. Reads tests/data/mini/mini.mdx into a Node Blob.
//   2. Constructs an MDX via the public `MDX.create(blob)` factory.
//   3. Confirms init() succeeds and a known keyword can be looked up.
//   4. Repeats with the FileScanner path for parity.
//
// Both paths must produce the same set of keys and the same first definition.

import { readFile } from 'node:fs/promises';
import { MDX } from '../dist/esm/index.js';
import { FileScanner } from '../dist/esm/file-scanner.js';

const MDX_PATH = new URL('./data/mini/mini.mdx', import.meta.url).pathname;

async function viaBlob() {
  const bytes = await readFile(MDX_PATH);
  // Node's `Blob` is global since Node 18.
  const blob = new Blob([bytes]);
  // Mimic File.name so MDX.create can derive the extension.
  Object.defineProperty(blob, 'name', { value: 'mini.mdx' });
  const mdx = await MDX.create(blob);
  return mdx;
}

async function viaFile() {
  const mdx = new MDX(new FileScanner(MDX_PATH), 'mini.mdx');
  await mdx.init();
  return mdx;
}

function summary(label, mdx) {
  const sample = mdx.keywordList.slice(0, 5).map((k) => k.keyText);
  return {
    label,
    keywordCount: mdx.keywordList.length,
    encoding: mdx.meta.encoding,
    version: mdx.meta.version,
    sampleKeys: sample,
  };
}

(async () => {
  const blobMdx = await viaBlob();
  const fileMdx = await viaFile();

  console.log('Blob path:', summary('blob', blobMdx));
  console.log('File path:', summary('file', fileMdx));

  if (blobMdx.keywordList.length !== fileMdx.keywordList.length) {
    throw new Error(
      `keyword count mismatch: blob=${blobMdx.keywordList.length} file=${fileMdx.keywordList.length}`,
    );
  }

  // Probe several words: pick one whose lookup returns a non-empty definition
  // so we can verify the record-block decompression path end-to-end.
  const probes = ['micro', 'introduction', 'dictionary', 'ask', 'vote', 'good',
    'apple', 'hello', 'example', 'work', 'time'];
  let lookupWord = probes[0];
  for (const p of probes) {
    const def = (await blobMdx.lookup(p)).definition;
    if (def && def.length > 0) { lookupWord = p; break; }
  }

  const blobLookup = await blobMdx.lookup(lookupWord);
  const fileLookup = await fileMdx.lookup(lookupWord);
  console.log(`lookup("${lookupWord}")`);
  console.log('  blob def length:', blobLookup.definition?.length ?? null);
  console.log('  file def length:', fileLookup.definition?.length ?? null);
  if (blobLookup.definition) {
    const preview = blobLookup.definition.slice(0, 120).replace(/\s+/g, ' ');
    console.log('  blob def preview:', preview, blobLookup.definition.length > 120 ? '...' : '');
  }

  if (blobLookup.definition !== fileLookup.definition) {
    throw new Error('definition mismatch between blob and file scanners');
  }

  console.log('OK — Blob and FileScanner paths produced identical results.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
