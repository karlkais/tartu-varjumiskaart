import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';

const root = resolve('docs');
// Development-only fixtures; these switches never enter the published bundles.
const stale = process.argv.includes('--test-stale') || process.argv.includes('--test-failure') || process.argv.includes('--test-basemap-failure');
const failure = process.argv.includes('--test-failure');
const basemapFailure = process.argv.includes('--test-basemap-failure');
const noWebGL = process.argv.includes('--test-no-webgl');
const port = Number(process.argv.find(arg => arg.startsWith('--port='))?.slice(7) || (failure || basemapFailure ? 8766 : 8765));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png' };
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
    if (!file.startsWith(root + sep)) { response.writeHead(403).end(); return; }
    let body = await readFile(file);
    if (stale && ['/snapshot.json', '/basemap.json.gz'].includes(pathname)) {
      const compressed = pathname.endsWith('.gz');
      const snapshot = JSON.parse(compressed ? gunzipSync(body).toString() : body.toString());
      snapshot.updatedAt = '2020-01-01T00:00:00Z';
      body = compressed ? gzipSync(JSON.stringify(snapshot)) : JSON.stringify(snapshot);
    }
    if (failure && pathname === '/app/worker.js') body = `globalThis.fetch = async () => { throw new Error('Test: andmeteenus ei vasta'); };\n${body}`;
    if (basemapFailure && pathname === '/app/worker.js') body = `const realFetch = globalThis.fetch; globalThis.fetch = (url, options) => String(url).includes('gsavalik.envir.ee') ? Promise.reject(new Error('Test: aluskaarditeenus ei vasta')) : realFetch(url, options);\n${body}`;
    if (noWebGL && pathname === '/app/app.js') body = `const canvasContext = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type.includes('webgl') ? null : canvasContext.call(this, type, ...args); };\n${body}`;
    response.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
  } catch { response.writeHead(404).end('Not found'); }
}).listen(port, '0.0.0.0', () => console.log(`Kaart: http://localhost:${port}${stale ? ' (aegunud andmete test)' : ''}`));
