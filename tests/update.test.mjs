import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { IDBFactory } from 'fake-indexeddb';
import { nextUpdateAt, isUpdateDue, newestSnapshot, refreshIfDue, validateSnapshot } from '../src/snapshot.mjs';
import { openCache } from '../src/cache.mjs';

const fixture = JSON.parse(await readFile(new URL('../docs/snapshot.json', import.meta.url), 'utf8'));
const now = Date.parse('2026-10-14T12:00:00Z');
const fresh = () => ({ ...structuredClone(fixture), updatedAt: '2026-10-01T12:00:00Z' });
const stale = () => ({ ...fresh(), updatedAt: '2026-04-01T12:00:00Z' });

test('strict six calendar month boundary, including month end and leap year', () => {
  for (const [start, end] of [
    ['2026-04-14T12:00:00Z', '2026-10-14T12:00:00Z'],
    ['2026-08-31T08:45:12Z', '2027-02-28T08:45:12Z'],
    ['2023-08-31T08:45:12Z', '2024-02-29T08:45:12Z'],
    ['2024-02-29T00:00:00Z', '2024-08-29T00:00:00Z']
  ]) {
    const boundary = Date.parse(end);
    assert.equal(nextUpdateAt(start), boundary);
    assert.equal(isUpdateDue({ updatedAt: start }, boundary - 1), false);
    assert.equal(isUpdateDue({ updatedAt: start }, boundary), false);
    assert.equal(isUpdateDue({ updatedAt: start }, boundary + 1), true);
  }
});

test('opening fresh data neither fetches, computes, saves, nor advances date', async () => {
  const original = fresh();
  const forbidden = () => { assert.fail('Fresh data must not trigger an update'); };
  const result = await refreshIfDue(original, { fetchData: forbidden, calculate: forbidden, save: forbidden, now: () => now });
  assert.equal(result.snapshot, original);
  assert.equal(result.state, 'fresh');
});

test('successful update stamps completion, saves the whole snapshot, then skips next opening', async () => {
  const events = [];
  let saved, clock = now;
  const result = await refreshIfDue(stale(), {
    fetchData: async () => { events.push('fetch'); return { populationYear: fixture.populationYear }; },
    calculate: async () => { events.push('calculate'); clock += 10_000; return fresh(); },
    save: async value => { events.push('save'); saved = value; }, now: () => clock
  });
  assert.deepEqual(events, ['fetch', 'calculate', 'save']);
  assert.equal(result.state, 'updated');
  assert.equal(saved, result.snapshot);
  assert.equal(saved.updatedAt, new Date(clock).toISOString());
  assert.equal(isUpdateDue(saved, clock + 1000), false);
});

for (const stage of ['fetch', 'calculate', 'validate', 'downgrade']) {
  test(`${stage} failure retains previous data and timestamp, remains due on next open`, async () => {
    const original = stale();
    const result = await refreshIfDue(original, {
      fetchData: async () => { if (stage === 'fetch') throw new Error('offline'); return { populationYear: stage === 'downgrade' ? 2025 : fixture.populationYear }; },
      calculate: async () => { if (stage === 'calculate') throw new Error('topology'); return stage === 'validate' ? {} : fresh(); },
      save: async () => assert.fail('Failed updates must not be saved'), now: () => now
    });
    assert.equal(result.state, 'failed'); assert.equal(result.snapshot, original);
    assert.equal(isUpdateDue(result.snapshot, now), true);
  });
}

test('storage failure reports unsaved fresh session data and preserves persistent snapshot', async () => {
  const original = stale();
  const result = await refreshIfDue(original, { fetchData: async () => fresh(), calculate: value => value, save: async () => { throw new Error('QuotaExceededError'); }, now: () => now });
  assert.equal(result.state, 'unsaved');
  assert.equal(result.snapshot.updatedAt, new Date(now).toISOString());
  assert.equal(original.updatedAt, '2026-04-01T12:00:00Z');
});

test('selects newer shipped/cache snapshot and rejects corrupt or incompatible data', () => {
  const newer = fresh(), older = stale();
  const corrupt = { ...fresh(), updatedAt: '2026-10-13T12:00:00Z', layers: {} };
  assert.equal(newestSnapshot([older, newer, corrupt, null], now), newer);
  assert.equal(newestSnapshot([newer, older], now), newer);
  assert.equal(newestSnapshot([{ ...newer, schemaVersion: 999 }], now), null);
  assert.equal(newestSnapshot([{ ...newer, updatedAt: '2027-10-01T12:00:00Z' }], now), null);
});

test('rejects nonfinite geometry, wrong loads and broken allocation', () => {
  for (const mutate of [
    value => { value.layers.shelters.features[0].geometry.coordinates[0] = null; },
    value => { value.layers.shelters.features.find(f => f.properties.capacity > 0).properties.ratio = 99; },
    value => { value.layers.population.features[0].properties.shelterId = -100; },
    value => { value.layers.population.features[0].properties.residents += 10; }
  ]) {
    const value = fresh(); mutate(value);
    assert.throws(() => validateSnapshot(value, now));
  }
});

test('IndexedDB snapshot survives reopening and replaces all layers atomically', async () => {
  const idb = new IDBFactory();
  let cache = await openCache(idb);
  assert.equal(await cache.read(), null);
  await cache.save(stale()); cache.close();
  cache = await openCache(idb);
  assert.equal((await cache.read()).updatedAt, stale().updatedAt);
  await cache.save(fresh());
  assert.deepEqual(await cache.read(), fresh());
  await cache.save(stale());
  assert.deepEqual(await cache.read(), fresh(), 'An older tab cannot overwrite newer data');
  cache.close();
});
