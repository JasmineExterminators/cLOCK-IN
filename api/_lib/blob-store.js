// Crew storage on a private Vercel Blob store (uses BLOB_READ_WRITE_TOKEN from the project).
import { get, put, BlobPreconditionFailedError } from '@vercel/blob';
import { Conflict } from './crew.js';

const path = (code) => `crews/${code}.json`;
const opts = { access: 'private', addRandomSuffix: false, contentType: 'application/json', cacheControlMaxAge: 60 };

export const blobStore = {
  async read(code) {
    const r = await get(path(code), { access: 'private', useCache: false });
    if (!r || r.statusCode !== 200) return null;
    const text = await new Response(r.stream).text();
    return { doc: JSON.parse(text), etag: r.blob.etag };
  },

  async create(code, doc) {
    if (await this.read(code)) throw new Conflict('exists');
    try {
      await put(path(code), JSON.stringify(doc), { ...opts, allowOverwrite: false });
    } catch (e) {
      if (/already exists/i.test(String(e && e.message))) throw new Conflict('exists');
      throw e;
    }
  },

  async replace(code, doc, etag) {
    try {
      await put(path(code), JSON.stringify(doc), { ...opts, allowOverwrite: true, ifMatch: etag });
    } catch (e) {
      if (e instanceof BlobPreconditionFailedError) throw new Conflict('stale');
      throw e;
    }
  },
};
