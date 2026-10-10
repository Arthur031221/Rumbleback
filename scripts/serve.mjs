// A static file server for dist/, used by the end-to-end tests, the demo recorder and `npm run serve`.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webmanifest': 'application/manifest+json',
};

/** Serves a directory on a free port (or `port`) and resolves with the server and its base URL. `onRequest` sees each request the way a real host would. */
export function serve(dir, port = 0, onRequest = undefined) {
  const server = createServer(async (req, res) => {
    onRequest?.(req);
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      let file = normalize(join(dir, decodeURIComponent(url.pathname)));
      if (!file.startsWith(dir)) throw new Error('outside');
      if (url.pathname.endsWith('/')) file = join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  });
  return new Promise((resolve) =>
    server.listen(port, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` })),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = new URL('../dist/', import.meta.url).pathname;
  const { url } = await serve(dir, Number(process.env.PORT ?? 4173));
  console.log(`serving ${dir} at ${url}`);
}
