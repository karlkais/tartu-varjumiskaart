import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root = resolve('docs');
// Development-only fixtures; these switches never enter the published bundles.
const stale = process.argv.includes('--test-stale') || process.argv.includes('--test-failure');
const failure = process.argv.includes('--test-failure');
const port = failure ? 8766 : 8765;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png' };
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
    if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    let body = await readFile(file);
    if (stale && pathname === '/snapshot.json') {
      const snapshot = JSON.parse(body.toString());
      snapshot.updatedAt = '2020-01-01T00:00:00Z';
      body = JSON.stringify(snapshot);
    }
    if (failure && pathname === '/app/worker.js') body = `globalThis.fetch = async () => { throw new Error('Test: andmeteenus ei vasta'); };\n${body}`;
    response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(port, '0.0.0.0', () => console.log(`Kaart: http://localhost:${port}${stale ? ' (aegunud andmete test)' : ''}`));
