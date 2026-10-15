import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseShelterCSV, fetchNationalShelters, NATIONAL_SHELTERS_URL, NATIONAL_SHELTERS_PAGE } from '../src/national-shelters.mjs';
import { addressKeys, reconcileShelters, validateShelterContext } from '../src/shelter-reconciliation.mjs';
import { calculateModel } from '../src/model.mjs';
import { validateSnapshot } from '../src/snapshot.mjs';

const raw = JSON.parse(await readFile(new URL('../data/source-snapshot.json', import.meta.url)));
const csv = await readFile(new URL('../data/national-shelters.csv', import.meta.url), 'utf8');
const national = parseShelterCSV(csv);
const sources = { city: { url: raw.sources.shelters, retrievedAt: raw.retrievedAt },
  national: { url: NATIONAL_SHELTERS_URL, pageUrl: NATIONAL_SHELTERS_PAGE, retrievedAt: raw.retrievedAt, modifiedAt: null, data: national } };
const fixture = { ...raw, shelterSources: sources };
const header = 'id;nimi;aadress;tyyp;lest_x;lest_y\n';

test('national CSV handles BOM, quoted semicolons, quotes and newlines; L-EST axes produce Tartu', () => {
  const result = parseShelterCSV('\uFEFF' + header + 'X;"Kooli; \"\"maja\"\"\nkelder";Põllu 11c;Varjumiskoht;6476462.77;658704.35\r\n');
  const f = result.features[0];
  assert.equal(f.properties.nimi, 'Kooli; "maja"\nkelder');
  assert.ok(f.geometry.coordinates[0] > 26.7 && f.geometry.coordinates[0] < 26.8);
  assert.ok(f.geometry.coordinates[1] > 58.39 && f.geometry.coordinates[1] < 58.42);
});

test('national CSV rejects truncation, duplicates, missing fields and bad coordinates', () => {
  const row = 'X;Kool;Põllu 11c;Varjumiskoht;6476462.77;658704.35\n';
  for (const text of [header, header + row + row, header + 'X;"unfinished', header + row.replace('6476462.77', ''),
    header + row.replace('6476462.77', '658704.35'), header + row.replace('Varjumiskoht', 'Muu'), header.replace('aadress', 'other') + row]) {
    assert.throws(() => parseShelterCSV(text));
  }
});

test('national loader fails closed and preserves retrieval and file dates separately', async () => {
  await assert.rejects(fetchNationalShelters(async () => new Response('Down', { status: 503 })), /503/);
  await assert.rejects(fetchNationalShelters(async () => new Response('id;nimi')), /väljad/);
  const result = await fetchNationalShelters(async (url, options) => {
    assert.equal(url, NATIONAL_SHELTERS_URL); assert.equal(options.credentials, 'omit');
    return new Response(csv, { headers: { 'last-modified': 'Wed, 14 Oct 2026 21:30:00 GMT' } });
  });
  assert.equal(result.modifiedAt, '2026-10-14T21:30:00.000Z');
  assert.ok(Number.isFinite(Date.parse(result.retrievedAt)));
});

test('address aliases retain suffixes and expand compound city addresses', () => {
  assert.deepEqual(addressKeys('Ravila tn 14a // 14b // W. Ostwaldi tn 1, Tartu linn'), ['ravila 14a', 'ravila 14b', 'w ostwaldi 1']);
  assert.deepEqual(addressKeys('Tartu maakond, Tartu linn, Tartu linn, Põllu tn 11c'), ['põllu 11c']);
  assert.notDeepEqual(addressKeys('Põllu 11a'), addressKeys('Põllu 11c'));
});

test('public-source union yields 29 points and does not change any known capacity or allocation', () => {
  const result = validateSnapshot({ ...calculateModel(fixture), updatedAt: raw.retrievedAt });
  const old = calculateModel({ ...raw, shelterSources: undefined });
  assert.deepEqual(result.shelterContext.counts, { both: 23, 'city-only': 4, 'national-only': 2, ambiguous: 0, 'status-conflict': 0 });
  assert.equal(result.layers.shelters.features.length, 29);
  assert.deepEqual(result.layers.population, old.layers.population);
  for (const f of old.layers.shelters.features) {
    const current = result.layers.shelters.features.find(x => x.properties.id === f.properties.id);
    const { sourceAudit, ...properties } = current.properties;
    assert.deepEqual(properties, f.properties); assert.deepEqual(current.geometry, f.geometry);
  }
  for (const id of ['paaste:LÕ206', 'paaste:LÕ223']) {
    const p = result.layers.shelters.features.find(f => f.properties.id === id).properties;
    assert.equal(p.capacity, null); assert.equal(p.assigned, null); assert.equal(p.sourceAudit.fields.capacity, null);
  }
});

const cityPoint = raw.layers.shelters.features.find(f => f.id === 5);
const nationalPoint = national.features.find(f => f.id === 'LÕ241');
test('reviewed Põllu alias never absorbs the separate 11c dormitory or an altered source identity', () => {
  const result = reconcileShelters([cityPoint], national.features.filter(f => ['LÕ241', 'LÕ223'].includes(f.id)));
  assert.equal(result.length, 2);
  assert.equal(result[0].properties.sourceAudit.national.id, 'LÕ241');
  assert.equal(result[1].properties.Mahutavus, null);
  const changed = structuredClone(cityPoint); changed.properties.GlobalID = 'different';
  assert.equal(reconcileShelters([changed], [nationalPoint]).length, 2);
});

test('matching requires an address and proximity; ambiguous candidates are not combined', () => {
  const city = structuredClone(cityPoint), n = structuredClone(nationalPoint);
  city.properties.Aadress = 'Põllu 11a';
  assert.equal(reconcileShelters([city], [n]).length, 1);
  const far = structuredClone(n); far.geometry.coordinates[0] += .02;
  assert.equal(reconcileShelters([city], [far]).length, 2);
  n.properties.aadress = 'Põllu 11c';
  assert.equal(reconcileShelters([city], [n]).length, 2);
  const second = structuredClone(nationalPoint); second.id = 'OTHER';
  const ambiguous = reconcileShelters([city], [nationalPoint, second]);
  assert.equal(ambiguous.length, 3);
  assert.ok(ambiguous.every(f => f.properties.sourceAudit.status === 'ambiguous'));
  assert.equal(ambiguous.reduce((sum, f) => sum + (f.properties.Mahutavus ?? 0), 0), 499);
});

test('explicit inactive city status is shown as a conflict and does not contribute capacity', () => {
  const city = structuredClone(cityPoint); city.properties.Toimiv = 0;
  const result = reconcileShelters([city], [nationalPoint]);
  assert.equal(result.length, 1);
  assert.equal(result[0].properties.sourceAudit.status, 'status-conflict');
  assert.equal(result[0].properties.Mahutavus, null);
  assert.equal(reconcileShelters([city], []).length, 0);
});

test('source audit rejects duplicate national identities, invented capacities and incorrect counts', () => {
  const result = calculateModel(fixture);
  for (const mutate of [
    r => { r.shelterContext.counts.both++; },
    r => { r.layers.shelters.features.at(-1).properties.capacity = 100; },
    r => { r.layers.shelters.features[1].properties.sourceAudit.national.id = r.layers.shelters.features[0].properties.sourceAudit.national.id; },
    r => { r.shelterContext.national.modifiedAt = 'invalid'; }
  ]) {
    const changed = structuredClone(result); mutate(changed);
    assert.throws(() => validateShelterContext(changed.shelterContext, changed.layers.shelters.features));
  }
});
