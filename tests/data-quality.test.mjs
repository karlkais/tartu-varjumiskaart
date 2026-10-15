import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import GeoJSONReader from 'jsts/org/locationtech/jts/io/GeoJSONReader.js';
import { calculateModel } from '../src/model.mjs';
import { validateSnapshot, refreshIfDue, newestSnapshot } from '../src/snapshot.mjs';
import { validateRawLayers, checkGeometry } from '../src/geometry-validation.mjs';
import { polygonArea, updateIssues, validateUpdate, DataQualityError } from '../src/data-quality.mjs';
import { changeFingerprint, reviewUpdate } from '../scripts/update-review.mjs';

const raw = JSON.parse(await readFile(new URL('../data/source-snapshot.json', import.meta.url), 'utf8'));
const baseline = JSON.parse(await readFile(new URL('../docs/snapshot.json', import.meta.url), 'utf8'));
const calculate = input => validateSnapshot({ ...calculateModel(input), updatedAt: baseline.updatedAt });

for (const [label, mutate] of [
  ['all residents reassigned to one shelter with unchanged global sums', s => { for (const f of s.layers.population.features) f.properties.shelterId = s.layers.shelters.features.find(f => f.properties.capacity > 0).properties.id; }],
  ['assignment to unknown capacity', s => { s.layers.population.features[0].properties.shelterId = s.layers.shelters.features.find(f => f.properties.capacity === null).properties.id; }],
  ['duplicate population ID', s => { s.layers.population.features[1].properties.id = String(s.layers.population.features[0].properties.id); }],
  ['null shelter ID', s => { s.layers.shelters.features[0].properties.id = null; }],
  ['duplicate district name', s => { s.layers.districts.features[1].properties.name = s.layers.districts.features[0].properties.name; }],
  ['district replaced by Point(0,0)', s => { s.layers.districts.features[0].geometry = { type: 'Point', coordinates: [0, 0] }; }],
  ['valid polygon outside Tartu', s => { s.layers.districts.features[0].geometry = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }; }],
  ['polygon ring not closed', s => { s.layers.population.features[0].geometry.coordinates[0].pop(); }],
  ['negative capacity', s => { s.layers.shelters.features[0].properties.capacity = -1; }],
  ['missing water ID in new snapshot', s => { delete s.layers.water.features[0].properties.id; }],
  ['same ID in positive and zero population', s => { const f = structuredClone(s.layers.population.features[0]); f.properties.residents = 0; s.layers.zeroPopulation.features.push(f); }],
  ['corrupt district population total', s => { s.quality.districts[0].residents++; }]
]) test(`rejects invalid snapshot: ${label}`, () => {
  const changed = structuredClone(baseline); mutate(changed);
  assert.throws(() => validateSnapshot(changed));
});

test('legacy district/water IDs remain optional only when all are absent; prefer quality metadata on equal timestamp', () => {
  const old = structuredClone(baseline); delete old.quality;
  for (const key of ['water', 'districts']) for (const f of old.layers[key].features) delete f.properties.id;
  assert.equal(validateSnapshot(old), old);
  assert.equal(newestSnapshot([old, baseline]), baseline);
  old.layers.water.features[0].properties.id = 'mixed';
  assert.throws(() => validateSnapshot(old));
});

test('raw schemas are enforced even when bypassing the network downloader', () => {
  for (const mutate of [
    r => { r.layers.population.features[0].properties.sum_sum_kokku = null; },
    r => { r.layers.population.features[1].id = r.layers.population.features[0].id; },
    r => { r.layers.shelters.features[0].properties.Mahutavus = -10; },
    r => { r.layers.shelters.features[0].properties.Toimiv = 99; },
    r => { r.layers.shelters.features[0].properties.Aadress = ' '; },
    r => { r.layers.shelters.features[1].properties.GlobalID = r.layers.shelters.features[0].properties.GlobalID; },
    r => { r.layers.districts.features[0].geometry = { type: 'Point', coordinates: [26.7, 58.37] }; },
    r => { r.shelterSources.national.data.features[1].id = r.shelterSources.national.data.features[0].id; },
    r => { r.shelterSources.national.data.features[0].geometry.coordinates = [0, 0]; }
  ]) {
    const changed = structuredClone(raw); mutate(changed);
    assert.throws(() => calculateModel(changed));
  }
  const pending = structuredClone(raw); pending.layers.shelters.features[0].properties.Toimiv = 2;
  assert.doesNotThrow(() => validateRawLayers(pending), 'The documented Avamisel state is valid source data');
});

test('geometry structure rejects collapsed rings and wrong nesting; area subtracts holes', () => {
  for (const coordinates of [[26.7, 58.37], [[[26.7, 58.37], [26.7, 58.37], [26.7, 58.37], [26.7, 58.37]]]]) {
    assert.throws(() => checkGeometry({ type: 'Polygon', coordinates }));
  }
  const exterior = [[26.7, 58.37], [26.72, 58.37], [26.72, 58.39], [26.7, 58.39], [26.7, 58.37]];
  const hole = [[26.705, 58.375], [26.715, 58.375], [26.715, 58.385], [26.705, 58.385], [26.705, 58.375]];
  const area = rings => polygonArea({ type: 'Polygon', coordinates: rings });
  assert.ok(Math.abs(area([exterior, hole]) - (area([exterior]) - area([hole]))) < 1e-6);
});

test('a 100-object source is internally calculable but cannot replace the previous snapshot, even in a new year', async () => {
  const changed = structuredClone(raw); changed.layers.population.features = changed.layers.population.features.slice(0, 100);
  const candidate = calculate(changed);
  assert.equal(candidate.quality.sources.population, 100);
  const original = { ...baseline, updatedAt: '2020-01-01T00:00:00Z' };
  for (const populationYear of [baseline.populationYear, baseline.populationYear + 1]) {
    const next = structuredClone(candidate); next.populationYear = populationYear;
    delete next.populationContext; // Test guard independently of optional same-year comparison.
    const result = await refreshIfDue(original, { fetchData: async () => next, calculate: x => x,
      save: async () => assert.fail('Incomplete update must never be saved') });
    assert.equal(result.state, 'failed'); assert.equal(result.snapshot, original);
    assert.ok(result.error instanceof DataQualityError);
    assert.ok(result.error.issues.some(i => i.key === 'source:population'));
    assert.equal(result.snapshot.updatedAt, '2020-01-01T00:00:00Z');
  }
});

test('district coverage detects local loss which city-wide totals alone would miss', () => {
  const changed = structuredClone(raw), reader = new GeoJSONReader();
  const region = reader.read(raw.layers.districts.features.find(f => f.properties.NIMI === 'Variku').geometry);
  changed.layers.population.features = changed.layers.population.features.filter(f => !reader.read(f.geometry).within(region));
  const candidate = calculate(changed), issues = updateIssues(baseline, candidate);
  assert.ok(!issues.some(i => ['residents', 'populationCells', 'source:population'].includes(i.key)));
  assert.ok(issues.some(i => i.key === 'coverage:Variku'));
});

test('unchanged data and small measured changes pass; excessive capacity growth and lost quality metadata stop updates', () => {
  assert.equal(validateUpdate(baseline, baseline), baseline);
  const small = structuredClone(baseline); small.quality.sources.population++;
  assert.equal(validateUpdate(baseline, small), small);
  const large = structuredClone(baseline);
  for (const f of large.layers.shelters.features) if (f.properties.capacity > 0) f.properties.capacity *= 2;
  assert.ok(updateIssues(baseline, large).some(i => i.key === 'capacity'));
  const missing = structuredClone(baseline); delete missing.quality;
  assert.throws(() => validateUpdate(baseline, missing), DataQualityError);
});

test('review approval binds to baseline and candidate, requires a reason and cannot bypass structural checks', () => {
  const candidate = structuredClone(baseline);
  candidate.quality.sources.population *= 2; // A structurally valid source change, requiring investigation.
  const token = changeFingerprint(baseline, candidate);
  assert.throws(() => reviewUpdate(baseline, candidate), error => error.review.fingerprint === token && error.review.issues.length > 0);
  assert.throws(() => reviewUpdate(baseline, candidate, { token, reason: 'ok' }), /põhjendus/);
  const reason = 'Kontrollitud uue lähtekihi ulatust avaldatud geomeetriate ja kirjeldustega.';
  const accepted = reviewUpdate(baseline, candidate, { token, reason });
  assert.equal(accepted.changeReview.reason, reason);
  const later = { ...candidate, updatedAt: new Date().toISOString() };
  assert.equal(changeFingerprint(baseline, later), token);
  assert.throws(() => reviewUpdate({ ...baseline, updatedAt: '2020-01-01T00:00:00Z' }, candidate, { token, reason }), /tunnus/);
  candidate.quality.sources.population++;
  assert.throws(() => reviewUpdate(baseline, candidate, { token, reason }), /tunnus/);
  candidate.layers.population.features[0].properties.shelterId = 'missing';
  assert.throws(() => reviewUpdate(baseline, candidate, { token: changeFingerprint(baseline, candidate), reason }), /rahvastikuarvutus/);
});
