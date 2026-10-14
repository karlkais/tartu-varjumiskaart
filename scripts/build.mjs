import { build } from 'esbuild';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { validateSnapshot } from '../src/snapshot.mjs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

validateSnapshot(JSON.parse(await readFile('docs/snapshot.json', 'utf8')));
await mkdir('docs/app', { recursive: true });
await build({ entryPoints: ['src/app.mjs', 'src/worker.mjs'], outdir: 'docs/app', bundle: true, minify: true, format: 'esm', target: ['es2022'], supported: { 'template-literal': false }, legalComments: 'linked' });
await Promise.all([
  copyFile('src/index.html', 'docs/index.html'),
  copyFile('src/style.css', 'docs/app/style.css'),
  copyFile('node_modules/leaflet/dist/leaflet.css', 'docs/app/leaflet.css'),
  writeFile('docs/.nojekyll', '')
]);
await mkdir('docs/app/images', { recursive: true });
await Promise.all(['layers.png', 'layers-2x.png', 'marker-icon.png', 'marker-icon-2x.png', 'marker-shadow.png'].map(name => copyFile(`node_modules/leaflet/dist/images/${name}`, `docs/app/images/${name}`)));
const licenses = [];
for (const [name, path] of [['Leaflet', 'leaflet/LICENSE'], ['Proj4js', 'proj4/LICENSE.md']]) {
  licenses.push(`${name}\n${await readFile(`node_modules/${path}`, 'utf8')}`);
}
licenses.push(`JSTS (EDL-1.0)\n${await readFile('licenses/JSTS-EDL-1.0.txt', 'utf8')}`);
const require = createRequire(import.meta.url);
for (const [name, parent, license] of [['mgrs', 'proj4', 'license.md'], ['wkt-parser', 'proj4', 'LICENSE.md'], ['fastpriorityqueue', 'jsts', 'LICENSE']]) {
  const packagePath = require.resolve(`${name}/package.json`, { paths: [dirname(require.resolve(`${parent}/package.json`))] });
  licenses.push(`${name}\n${await readFile(join(dirname(packagePath), license), 'utf8')}`);
}
await writeFile('docs/app/THIRD-PARTY-LICENSES.txt', licenses.map(text => text.replace(/[ \t]+$/gm, '').trim()).join('\n\n---------------------\n\n') + '\n');
console.log('Valmis: docs/. Andmete kuupäeva koostamine ei muuda.');
