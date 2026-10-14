import { build } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { validateSnapshot } from '../src/snapshot.mjs';
import { validateBasemap } from '../src/basemap-data.mjs';
import { thirdPartyLicenses } from './licenses.mjs';
import { gzipSync } from 'node:zlib';

validateSnapshot(JSON.parse(await readFile('docs/snapshot.json', 'utf8')));
const basemapJSON = await readFile('data/basemap-snapshot.json');
validateBasemap(JSON.parse(basemapJSON.toString('utf8')));
await writeFile('docs/basemap.json.gz', gzipSync(basemapJSON, { level: 9 }));
await mkdir('docs/app', { recursive: true });
await build({ entryPoints: { app: 'src/app.mjs', worker: 'src/worker.mjs', 'maplibre-worker': 'node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs' }, outdir: 'docs/app', bundle: true, minify: true, format: 'esm', target: ['es2022'], supported: { 'template-literal': false }, legalComments: 'linked' });
await Promise.all([
  copyFile('src/index.html', 'docs/index.html'),
  copyFile('src/style.css', 'docs/app/style.css'),
  copyFile('node_modules/leaflet/dist/leaflet.css', 'docs/app/leaflet.css'),
  copyFile('node_modules/maplibre-gl/dist/maplibre-gl.css', 'docs/app/maplibre-gl.css'),
  writeFile('docs/.nojekyll', '')
]);
await mkdir('docs/app/images', { recursive: true });
await Promise.all(['layers.png', 'layers-2x.png', 'marker-icon.png', 'marker-icon-2x.png', 'marker-shadow.png'].map(name => copyFile(`node_modules/leaflet/dist/images/${name}`, `docs/app/images/${name}`)));
await writeFile('docs/app/THIRD-PARTY-LICENSES.txt', await thirdPartyLicenses());
console.log('Valmis: docs/. Andmete kuupäeva koostamine ei muuda.');
