import { Mdict } from './mdict';
import { MDictOptions } from './mdict-base';
import { BlobScanner, Scanner } from './scanner';
import { bytesToBase64 } from './byte-utils';

type LocateResult = { keyText: string; definition: string | null };

export class MDD extends Mdict {
  // Reuse Mdict's flexible constructor: accepts either a path string (legacy
  // sync API, Node only) or a Scanner + name (the new async-friendly API).
  constructor(input: string | Scanner, nameOrOptions?: string | Partial<MDictOptions>, optionsArg?: Partial<MDictOptions>) {
    super(input as string | Scanner, nameOrOptions, optionsArg);
  }

  /**
   * Create and initialize an MDD from a Blob/File. Same lazy semantics as
   * {@link MDX.create} — slices are read on demand.
   */
  static async create(file: Blob, options?: Partial<MDictOptions>): Promise<MDD> {
    const name = (file as File).name ?? 'unknown.mdd';
    const mdd = new MDD(new BlobScanner(file), name, options);
    await mdd.init();
    return mdd;
  }

  /**
   * Locate a resource by key. Returns base64-encoded resource bytes for
   * compatibility with the legacy API (callers that used `.definition`).
   *
   * Sync when the scanner is sync, async otherwise. The TS overload exposes
   * the sync return so legacy `mdd.locate(k).definition` keeps compiling;
   * async-scanner users should `await`, which works either way.
   */
  locate(resourceKey: string): LocateResult;
  locate(resourceKey: string): LocateResult | Promise<LocateResult> {
    let normalizedKey = resourceKey.replace(/\//g, '\\');
    if (normalizedKey.length > 0 && !normalizedKey.startsWith('\\')) {
      normalizedKey = '\\' + normalizedKey;
    }
    const item = this.lookupKeyBlockByWord(normalizedKey);
    if (!item) {
      return { keyText: resourceKey, definition: null };
    }
    const finish = (meaningBuff: Uint8Array): LocateResult => {
      if (!meaningBuff) return { keyText: resourceKey, definition: null };
      return { keyText: resourceKey, definition: bytesToBase64(meaningBuff) };
    };
    const buf = this.lookupRecordByKeyBlock(item);
    return buf instanceof Promise ? buf.then(finish) : finish(buf);
  }

  /**
   * Locate a resource and return raw bytes. Useful for callers who want to
   * wrap the result in a Blob for `URL.createObjectURL(...)` rather than
   * paying for base64 encoding/decoding.
   */
  locateBytes(resourceKey: string): { keyText: string; data: Uint8Array | null } | Promise<{ keyText: string; data: Uint8Array | null }> {
    let normalizedKey = resourceKey.replace(/\//g, '\\');
    if (normalizedKey.length > 0 && !normalizedKey.startsWith('\\')) {
      normalizedKey = '\\' + normalizedKey;
    }
    const item = this.lookupKeyBlockByWord(normalizedKey);
    if (!item) return { keyText: resourceKey, data: null };
    const finish = (data: Uint8Array): { keyText: string; data: Uint8Array | null } => ({
      keyText: resourceKey,
      data: data ?? null,
    });
    const buf = this.lookupRecordByKeyBlock(item);
    return buf instanceof Promise ? buf.then(finish) : finish(buf);
  }
}
