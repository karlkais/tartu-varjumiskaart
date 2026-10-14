import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calculateModel } from '../src/model.mjs';
import { validateSnapshot } from '../src/snapshot.mjs';

const raw = JSON.parse(await readFile(new URL('../data/source-snapshot.json', import.meta.url), 'utf8'));
const reference = JSON.parse(await readFile(new URL('./reference.json', import.meta.url), 'utf8'));

test('browser model agrees with independent R/sf/GEOS reference for every cell and shelter', () => {
  const result = validateSnapshot({ ...calculateModel(raw), updatedAt: raw.retrievedAt });
  assert.equal(result.populationYear, reference.populationYear);
  assert.equal(result.layers.shelters.features.length, reference.shelterCount);
  assert.equal(result.layers.water.features.length, reference.waterCount);
  assert.equal(result.layers.population.features.length, reference.population.length);
  const actualShelters = new Map(result.layers.shelters.features.map(f => [f.properties.id, f.properties]));
  const actualCells = new Map(result.layers.population.features.map(f => [f.properties.id, f.properties]));
  for (const expected of reference.shelters) {
    const actual = actualShelters.get(expected.id);
    assert.equal(actual.capacity, expected.capacity);
    assert.ok(Math.abs(actual.assigned - expected.assigned) < .01, `Shelter ${expected.id}: ${actual.assigned} vs ${expected.assigned}`);
    assert.ok(Math.abs(actual.ratio - expected.ratio) < .00001, `Ratio ${expected.id}`);
  }
  for (const expected of reference.population) {
    const actual = actualCells.get(expected.id);
    assert.equal(actual.shelterId, expected.shelterId, `Assignment ${expected.id}`);
    assert.ok(Math.abs(actual.residents - expected.residents) < .01, `Area weighting ${expected.id}`);
  }
});
