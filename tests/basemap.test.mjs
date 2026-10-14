import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { IDBFactory } from 'fake-indexeddb';
import { openCache } from '../src/cache.mjs';
import { cityOutline } from '../src/model.mjs';
import GeoJSONReader from 'jsts/org/locationtech/jts/io/GeoJSONReader.js';
import { basemapBounds, downloadBasemapLayer, validateBasemap, newestBasemap, refreshBasemapIfDue } from '../src/basemap-data.mjs';
import { isUpdateDue, refreshIfDue } from '../src/snapshot.mjs';

const baseline = JSON.parse(await readFile(new URL('../data/basemap-snapshot.json', import.meta.url), 'utf8'));
const thematic = JSON.parse(await readFile(new URL('../docs/snapshot.json', import.meta.url), 'utf8'));
const now = Date.parse(baseline.updatedAt);
const fresh = () => ({ ...baseline, updatedAt: '2026-10-01T12:00:00Z', layers: Object.fromEntries(Object.entries(baseline.layers).map(([k, v]) => [k, { ...v, features: structuredClone(v.features.slice(0, 3)) }])) });
const stale = () => ({ ...fresh(), updatedAt: '2026-01-01T12:00:00Z' });

function service(count, mutate = () => {}) {
  const calls = [];
  const fetcher = async url => {
    const q = new URL(url).searchParams;
    assert.equal(q.get('srsName'), 'urn:ogc:def:crs:OGC:1.3:CRS84');
    assert.match(q.get('bbox'), /CRS84$/); assert.equal(q.get('sortBy'), 'fid A');
    const start = Number(q.get('startIndex')), size = Number(q.get('count'));
    assert.ok(start < count, 'The WFS empty-page bug must not be triggered');
    calls.push(start);
    const features = Array.from({ length: Math.min(size, count - start) }, (_, i) => ({
      type: 'Feature', properties: { fid: start + i, nimetus: 'Tähe tänav', ads_nimetus: null, karto_nimi: null, laius: 5, tahtsus: 2, tyyp: 10 },
      geometry: { type: 'LineString', coordinates: [[26.72, 58.37], [26.721, 58.371]] }
    }));
    const page = { type: 'FeatureCollection', features, numberReturned: features.length, numberMatched: Math.min(count, 5000) };
    mutate(page, start);
    return new Response(JSON.stringify(page), { status: 200 });
  };
  return { calls, fetcher };
}

test('shipped basemap is complete and contains all six validated regional layers', () => {
  assert.equal(validateBasemap(baseline, now), baseline);
  assert.ok(baseline.layers.buildings.features.length > 30_000);
  assert.ok(baseline.layers.roads.features.some(f => /[õäöü]/i.test(f.properties.name)));
  const bounds = basemapBounds(thematic.layers.districts);
  assert.deepEqual(bounds, baseline.bounds);
});

for (const count of [1000, 5995, 6200]) test(`WFS pagination reads ${count} objects beyond capped counts and overlaps page boundaries`, async () => {
  const mock = service(count);
  const result = await downloadBasemapLayer('roads', baseline.bounds, mock.fetcher);
  assert.equal(result.features.length, count);
  assert.equal(new Set(result.features.map(f => f.id)).size, count);
  assert.equal(result.features.at(-1).id, count - 1);
  assert.equal(result.features[0].properties.name, 'Tähe tänav');
  assert.equal(mock.calls[1], 999);
});

for (const failure of ['truncated', 'shifted', 'duplicate', 'changed-count', 'missing-field', 'bad-geometry']) test(`WFS rejects ${failure}`, async () => {
  const mock = service(6200, (page, start) => {
    if (start === 999) {
      if (failure === 'truncated') { page.features = page.features.slice(0, 2); page.numberReturned = 2; }
      if (failure === 'shifted') page.features[0].properties.fid++;
      if (failure === 'duplicate') page.features[1].properties.fid = page.features[0].properties.fid;
      if (failure === 'changed-count') page.numberMatched = 4999;
      if (failure === 'missing-field') delete page.features[1].properties.laius;
      if (failure === 'bad-geometry') page.features[1].geometry.coordinates[0][0] = null;
    }
  });
  await assert.rejects(downloadBasemapLayer('roads', baseline.bounds, mock.fetcher));
});

test('basemap uses strict six calendar months and fresh openings make no requests', async () => {
  const current = stale();
  const boundary = Date.parse('2026-07-01T12:00:00Z');
  assert.equal(isUpdateDue(current, boundary), false);
  assert.equal(isUpdateDue(current, boundary + 1), true);
  const forbidden = () => assert.fail('Fresh basemap must not refresh');
  const result = await refreshBasemapIfDue(fresh(), { now: () => now, fetchData: forbidden, save: forbidden });
  assert.equal(result.state, 'fresh');
});

test('failed or truncated refresh keeps old basemap and timestamp', async () => {
  for (const fail of ['network', 'partial', 'large-drop']) {
    const current = stale();
    const result = await refreshBasemapIfDue(current, {
      now: () => now, save: () => assert.fail('Must not save an incomplete map'),
      fetchData: async () => {
        if (fail === 'network') throw new Error('offline');
        const next = fresh();
        if (fail === 'partial') delete next.layers.lakes;
        if (fail === 'large-drop') next.layers.roads.features = next.layers.roads.features.slice(0, 1);
        return next;
      }
    });
    assert.equal(result.state, 'failed'); assert.equal(result.snapshot, current);
  }
});

test('successful basemap refresh stamps completion and storage failures retain session data', async () => {
  for (const unavailable of [false, true]) {
    const result = await refreshBasemapIfDue(stale(), { now: () => now, fetchData: async () => fresh(), save: async () => { if (unavailable) throw new Error('QuotaExceededError'); } });
    assert.equal(result.state, unavailable ? 'unsaved' : 'updated');
    assert.equal(result.snapshot.updatedAt, new Date(now).toISOString());
  }
  assert.equal(newestBasemap([{ ...fresh(), version: 999 }, { ...fresh(), layers: {} }, stale(), fresh()], now).updatedAt, fresh().updatedAt);
});

test('basemap cache coexists with existing shelter data and older tabs cannot overwrite it', async () => {
  const idb = new IDBFactory();
  let cache = await openCache(idb);
  await cache.save(thematic); await cache.saveBasemap(fresh()); cache.close();
  cache = await openCache(idb);
  assert.deepEqual(await cache.read(), thematic);
  assert.deepEqual(await cache.readBasemap(), fresh());
  await cache.saveBasemap(stale());
  assert.deepEqual(await cache.readBasemap(), fresh());
  cache.close();
});

test('a basemap failure does not roll back successfully refreshed shelter data', async () => {
  const cache = await openCache(new IDBFactory());
  const oldData = { ...thematic, updatedAt: stale().updatedAt };
  await cache.save(oldData); await cache.saveBasemap(stale());
  const data = await refreshIfDue(oldData, { now: () => now, fetchData: async () => thematic, calculate: v => v, save: cache.save });
  const base = await refreshBasemapIfDue(stale(), { now: () => now, fetchData: async () => { throw new Error('WFS offline'); }, save: cache.saveBasemap });
  assert.equal(data.state, 'updated'); assert.equal(base.state, 'failed');
  assert.equal((await cache.read()).updatedAt, new Date(now).toISOString());
  assert.equal((await cache.readBasemap()).updatedAt, stale().updatedAt);
  cache.close();
});

test('city outline dissolves adjacent districts and preserves islands and holes', () => {
  const polygon = coordinates => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates } });
  const districts = { type: 'FeatureCollection', features: [
    polygon([[[26.70, 58.37], [26.71, 58.37], [26.71, 58.38], [26.70, 58.38], [26.70, 58.37]]]),
    polygon([[[26.71, 58.37], [26.72, 58.37], [26.72, 58.38], [26.71, 58.38], [26.71, 58.37]]]),
    polygon([[[26.73, 58.37], [26.74, 58.37], [26.74, 58.38], [26.73, 58.38], [26.73, 58.37]], [[26.732, 58.372], [26.738, 58.372], [26.738, 58.378], [26.732, 58.378], [26.732, 58.372]]])
  ] };
  const outline = cityOutline(districts);
  const shape = new GeoJSONReader().read(outline.geometry);
  assert.equal(shape.isValid(), true);
  assert.equal(shape.getNumGeometries(), 2);
  assert.equal(outline.geometry.coordinates.flat().length, 3, 'Two exterior rings and one hole');
});
