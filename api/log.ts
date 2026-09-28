/**
 * Vercel Function for /api/log: error reports from every device land in a
 * private Vercel Blob store. All the logic is in server/log/core.ts; this
 * file only binds it to Blob and the platform.
 *
 * Environment:
 *   BLOB_READ_WRITE_TOKEN  set automatically when the Blob store is linked
 *   LOG_READ_TOKEN         the secret that allows GET (read) and DELETE
 */

import { del, get, list, put } from '@vercel/blob';
import { handleLog, memoryStore, type LogStore } from '../server/log/core.js';

function blobStore(): LogStore {
  return {
    async put(pathname, body) {
      await put(pathname, body, { access: 'private', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true });
    },
    async list(prefix) {
      const out: { pathname: string; url: string; uploadedAt: Date }[] = [];
      let cursor: string | undefined;
      do {
        const page = await list({ prefix, limit: 1000, cursor });
        for (const b of page.blobs) out.push({ pathname: b.pathname, url: b.url, uploadedAt: new Date(b.uploadedAt) });
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return out;
    },
    async read(url) {
      const res = await get(url, { access: 'private', useCache: false });
      if (!res || res.statusCode !== 200 || !res.stream) return null;
      return new Response(res.stream).text();
    },
    async del(urls) {
      if (urls.length) await del(urls);
    },
  };
}

// Without a Blob token (a fork, a preview with no store) reports are accepted
// and dropped rather than failing the client.
const store: LogStore = process.env.BLOB_READ_WRITE_TOKEN ? blobStore() : memoryStore();
const env = { readToken: process.env.LOG_READ_TOKEN };

export function GET(request: Request): Promise<Response> {
  return handleLog(request, store, env);
}

export function POST(request: Request): Promise<Response> {
  return handleLog(request, store, env);
}

export function DELETE(request: Request): Promise<Response> {
  return handleLog(request, store, env);
}
