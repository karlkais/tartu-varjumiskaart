import { readFile, writeFile, rename } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { fetchBasemap } from '../src/basemap-data.mjs';

const snapshot = JSON.parse(await readFile('docs/snapshot.json', 'utf8'));
const started = performance.now();
let downloaded = 0, requests = 0;
const result = await fetchBasemap(snapshot.layers.districts, {
  fetcher: async (url, options) => {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`WFS ${response.status} (${url}): ${(await response.text()).slice(0, 2000)}`);
    const bytes = await response.arrayBuffer(); downloaded += bytes.byteLength; requests++;
    return new Response(bytes, { status: response.status, headers: response.headers });
  },
  progress: (kind, count) => console.log(`${kind}: ${count}`)
});
const json = JSON.stringify(result);
await writeFile('data/basemap-snapshot.json.tmp', json + '\n');
await rename('data/basemap-snapshot.json.tmp', 'data/basemap-snapshot.json');
console.log(JSON.stringify({ seconds: Math.round((performance.now() - started) / 1000), requests,
  downloadedMB: +(downloaded / 1e6).toFixed(2), storedMB: +(Buffer.byteLength(json) / 1e6).toFixed(2),
  gzipMB: +(gzipSync(json).byteLength / 1e6).toFixed(2),
  features: Object.fromEntries(Object.entries(result.layers).map(([key, layer]) => [key, layer.features.length])) }, null, 2));
