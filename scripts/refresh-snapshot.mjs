import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fetchAllData } from '../src/sources.mjs';
import { calculateModel } from '../src/model.mjs';
import { validateSnapshot } from '../src/snapshot.mjs';
import { reviewUpdate } from './update-review.mjs';

const previous = validateSnapshot(JSON.parse(await readFile('docs/snapshot.json', 'utf8')));
const args = process.argv.slice(2);
if (args.some(arg => !arg.startsWith('--accept-change=') && !arg.startsWith('--reason='))) throw new Error('Tundmatu uuendusparameeter.');
const token = args.find(arg => arg.startsWith('--accept-change='))?.slice('--accept-change='.length);
const reason = args.find(arg => arg.startsWith('--reason='))?.slice('--reason='.length);
console.log('Laadin Tartu avaandmeid…');
const raw = await fetchAllData();
console.log(`Arvutan mudeli (${raw.populationYear})…`);
let snapshot = validateSnapshot({ ...calculateModel(raw), updatedAt: new Date().toISOString() });
try {
  snapshot = reviewUpdate(previous, snapshot, { token, reason });
} catch (error) {
  if (error.review) {
    await writeFile('data/update-review.json', JSON.stringify(error.review, null, 2));
    await writeFile('data/update-candidate.json', JSON.stringify(snapshot));
    console.error('Senised andmed säilisid. Vaata data/update-review.json ja data/update-candidate.json.');
  }
  throw error;
}
await mkdir('docs', { recursive: true });
await writeFile('data/national-shelters.csv', raw.shelterSources.national.csv);
delete raw.shelterSources.national.csv;
await writeFile('data/source-snapshot.json', JSON.stringify({ ...raw, retrievedAt: snapshot.updatedAt }));
await writeFile('docs/snapshot.json', JSON.stringify(snapshot));
console.log(JSON.stringify({ updatedAt: snapshot.updatedAt, populationYear: snapshot.populationYear, shelters: snapshot.layers.shelters.features.length, populationCells: snapshot.layers.population.features.length }));
