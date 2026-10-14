import { mkdir, writeFile } from 'node:fs/promises';
import { fetchAllData } from '../src/sources.mjs';
import { calculateModel } from '../src/model.mjs';
import { validateSnapshot } from '../src/snapshot.mjs';

console.log('Laadin Tartu avaandmeid…');
const raw = await fetchAllData();
console.log(`Arvutan mudeli (${raw.populationYear})…`);
const snapshot = validateSnapshot({ ...calculateModel(raw), updatedAt: new Date().toISOString() });
await mkdir('docs', { recursive: true });
await writeFile('data/source-snapshot.json', JSON.stringify({ ...raw, retrievedAt: snapshot.updatedAt }));
await writeFile('docs/snapshot.json', JSON.stringify(snapshot));
console.log(JSON.stringify({ updatedAt: snapshot.updatedAt, populationYear: snapshot.populationYear, shelters: snapshot.layers.shelters.features.length, populationCells: snapshot.layers.population.features.length }));
