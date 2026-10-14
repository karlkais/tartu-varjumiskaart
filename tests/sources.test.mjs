import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { discoverPopulation, downloadLayer, fetchAllData, getJSON, SOURCES } from '../src/sources.mjs';

const raw = JSON.parse(await readFile(new URL('../data/source-snapshot.json', import.meta.url), 'utf8'));
const json = data => new Response(JSON.stringify(data), { status: 200 });
const populationRoot = raw.sources.population.replace(/\/0$/, '');
const candidate = (year, extra = {}) => ({ title: `Rahvastik_${year}_100m andmed`, type: 'Feature Service', url: populationRoot, id: String(year), ...extra });

function fixtureAPI(mutate = (data => data)) {
  const requests = [];
  const fetcher = async (input, options) => {
    const url = new URL(input); requests.push(url);
    assert.equal(options.credentials, 'omit');
    assert.equal(options.cache, 'no-store');
    let data, kind;
    if (url.pathname.endsWith('/search')) {
      data = { results: [candidate(2025), candidate(2026), candidate(2099), candidate(2027, { title: 'Rahvastik 2027 linnaosad' }), candidate(2027, { type: 'Web Map' })], nextStart: -1 };
    } else if (url.href.split('?')[0] === populationRoot) data = { layers: [{ id: 0 }] };
    else {
      kind = Object.keys(raw.layers).find(key => input.startsWith(raw.sources[key]));
      assert.ok(kind, `Unexpected URL ${input}`);
      const layer = raw.layers[kind];
      const idField = kind === 'population' ? 'objectid' : 'OBJECTID';
      if (!url.pathname.endsWith('/query')) data = { objectIdField: idField, fields: Object.keys(layer.features[0].properties).map(name => ({ name })), geometryType: kind === 'shelters' ? 'esriGeometryPoint' : 'esriGeometryPolygon', maxRecordCount: 1000 };
      else if (url.searchParams.has('returnCountOnly')) data = { count: layer.features.length };
      else {
        assert.equal(url.searchParams.get('outSR'), '4326');
        assert.equal(url.searchParams.get('orderByFields'), `${idField} ASC`);
        const offset = Number(url.searchParams.get('resultOffset'));
        data = { type: 'FeatureCollection', features: layer.features.slice(offset, offset + Number(url.searchParams.get('resultRecordCount'))) };
      }
    }
    return json(mutate(structuredClone(data), url, kind));
  };
  return { fetcher, requests };
}

test('downloads all four layers, including all population pages and a final count check', async () => {
  const api = fixtureAPI();
  const result = await fetchAllData(api.fetcher);
  assert.equal(result.populationYear, 2026);
  for (const kind of Object.keys(raw.layers)) assert.equal(result.layers[kind].features.length, raw.layers[kind].features.length);
  const pages = api.requests.filter(url => url.href.startsWith(raw.sources.population) && url.searchParams.has('resultOffset'));
  assert.deepEqual(pages.map(url => Number(url.searchParams.get('resultOffset'))), [0, 1000, 2000]);
});

test('discovers a newly published year on subsequent catalogue page', async () => {
  const api = fixtureAPI((data, url) => {
    if (url.pathname.endsWith('/search')) return url.searchParams.get('start') === '1'
      ? { results: [candidate(2026)], nextStart: 101 }
      : { results: [candidate(2027)], nextStart: -1 };
    return data;
  });
  assert.equal((await discoverPopulation(api.fetcher, 2027)).year, 2027);
});

for (const failure of ['missing-page', 'duplicate-id', 'changed-count', 'invalid-field', 'null-population']) {
  test(`rejects incomplete refresh: ${failure}`, async () => {
    let counts = 0;
    const api = fixtureAPI((data, url, kind) => {
      if (kind !== 'population') return data;
      if (failure === 'changed-count' && 'count' in data && ++counts > 1) data.count++;
      if (failure === 'invalid-field' && data.fields) data.fields = data.fields.filter(f => f.name !== 'sum_sum_kokku');
      if (data.features && Number(url.searchParams.get('resultOffset')) === 1000) {
        if (failure === 'missing-page') data.features = [];
        if (failure === 'duplicate-id') data.features[0] = raw.layers.population.features[0];
        if (failure === 'null-population') data.features[0].properties.sum_sum_kokku = null;
      }
      return data;
    });
    await assert.rejects(downloadLayer(raw.sources.population, 'population', api.fetcher));
  });
}

test('rejects ArcGIS error payload even with HTTP 200', async () => {
  await assert.rejects(getJSON(SOURCES.shelters, async () => json({ error: { message: 'Service unavailable' } })), /Service unavailable/);
});
