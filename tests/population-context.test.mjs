import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calculateModel } from '../src/model.mjs';
import { validateSnapshot, newestSnapshot } from '../src/snapshot.mjs';
import { populationSummary } from '../src/population-context.mjs';

const raw = JSON.parse(await readFile(new URL('../data/source-snapshot.json', import.meta.url), 'utf8'));
const baseline = JSON.parse(await readFile(new URL('../docs/snapshot.json', import.meta.url), 'utf8'));
const calculate = value => ({ ...calculateModel(value), updatedAt: raw.retrievedAt });

test('legacy snapshots show unavailable coverage instead of borrowing a comparison', () => {
  const old = structuredClone(baseline);
  delete old.populationContext; delete old.layers.zeroPopulation;
  assert.equal(validateSnapshot(old), old);
  assert.equal(populationSummary(old).comparison, null);
  assert.ok(populationSummary(old).total > 0);
  assert.equal(newestSnapshot([old, baseline]), baseline, 'Prefer enriched metadata at the same update time');
});

test('published zeros stay distinct from omitted areas without changing assignments elsewhere', () => {
  const changed = structuredClone(raw);
  const displayed = baseline.layers.population.features[0];
  const input = changed.layers.population.features.find(f => f.id === displayed.properties.id);
  input.properties.sum_sum_kokku = 0;
  const result = validateSnapshot(calculate(changed));
  assert.equal(result.layers.zeroPopulation.features.length, 1);
  assert.equal(result.layers.zeroPopulation.features[0].properties.id, input.id);
  assert.equal(result.layers.zeroPopulation.features[0].properties.residents, 0);
  assert.equal(result.layers.population.features.some(f => f.properties.id === input.id), false);
  assert.ok(Math.abs(populationSummary(result).total - (populationSummary(baseline).total - displayed.properties.residents)) < .01);
  const previous = new Map(baseline.layers.population.features.map(f => [f.properties.id, f.properties.shelterId]));
  for (const f of result.layers.population.features) assert.equal(f.properties.shelterId, previous.get(f.properties.id));
});

for (const fault of ['different-year', 'missing-districts', 'wrong-region']) {
  test(`incompatible aggregate data (${fault}) is withheld without changing shelter loads`, () => {
    const changed = structuredClone(raw);
    if (fault === 'different-year') changed.populationContext.comparison.source.year--;
    if (fault === 'missing-districts') changed.populationContext.comparison.data.features.splice(1);
    if (fault === 'wrong-region') changed.populationContext.comparison.data.features[0].geometry = {
      type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]
    };
    const result = validateSnapshot(calculate(changed));
    assert.equal(result.populationContext.comparison, null);
    assert.ok(result.populationContext.unavailableReason);
    assert.deepEqual(result.layers.shelters, baseline.layers.shelters);
  });
}

test('comparison totals, source year and safe source links are checked before display', () => {
  for (const mutate of [
    c => { c.comparison.officialTotal++; },
    c => { c.comparison.modeledTotal++; },
    c => { c.comparison.source.year--; },
    c => { c.comparison.source.url = 'javascript:alert(1)'; },
    c => { c.comparison.districts[1].id = c.comparison.districts[0].id; }
  ]) {
    const value = structuredClone(baseline); mutate(value.populationContext);
    assert.throws(() => validateSnapshot(value));
    assert.equal(populationSummary(value).comparison, null);
  }
});
