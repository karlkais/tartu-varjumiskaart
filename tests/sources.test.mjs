import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { discoverPopulation, downloadLayer, fetchAllData, getJSON, SOURCES } from '../src/sources.mjs';
import { NATIONAL_SHELTERS_URL } from '../src/national-shelters.mjs';
import { calculateModel } from '../src/model.mjs';
import { refreshIfDue } from '../src/snapshot.mjs';

const raw = JSON.parse(await readFile(new URL('../data/source-snapshot.json', import.meta.url), 'utf8'));
const nationalCSV = await readFile(new URL('../data/national-shelters.csv', import.meta.url), 'utf8');
const json = data => new Response(JSON.stringify(data), { status: 200 });
const populationRoot = raw.sources.population.replace(/\/0$/, '');
const comparisonRoot = raw.populationContext.comparison.source.url.replace(/\/0$/, '');
const candidate = (year, extra = {}) => ({ title: `Rahvastik_${year}_100m andmed`, type: 'Feature Service', url: populationRoot, id: String(year), description: '<p>Ühe majapidamise andmeid sisaldavad alad on eemaldatud.</p>', snippet: 'Avaldatud rahvastik', modified: Date.parse('2026-06-26T00:00:00Z'), ...extra });
const comparisonCandidate = year => candidate(year, { title: `${year}_rahvastik_linnaosa andmed`, url: comparisonRoot });

function fixtureAPI(mutate = (data => data)) {
  const requests = [];
  const fetcher = async (input, options) => {
    const url = new URL(input); requests.push(url);
    assert.equal(options.credentials, 'omit');
    assert.equal(options.cache, 'no-store');
    if (input === NATIONAL_SHELTERS_URL) return new Response(nationalCSV);
    let data, kind;
    if (url.pathname.endsWith('/search')) {
      data = { results: [candidate(2025), candidate(2026), candidate(2099), comparisonCandidate(2025), comparisonCandidate(2026), candidate(2027, { type: 'Web Map' })], nextStart: -1 };
    } else if ([populationRoot, comparisonRoot].includes(url.href.split('?')[0])) data = { layers: [{ id: 0 }] };
    else {
      kind = input.startsWith(comparisonRoot) ? 'populationTotals' : Object.keys(raw.layers).find(key => input.startsWith(raw.sources[key]));
      assert.ok(kind, `Unexpected URL ${input}`);
      const layer = kind === 'populationTotals' ? raw.populationContext.comparison.data : raw.layers[kind];
      const idField = ['population', 'populationTotals'].includes(kind) ? 'objectid' : 'OBJECTID';
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
  assert.match(result.populationContext.source.description, /majapidamise/);
  assert.equal(result.populationContext.source.modifiedAt, '2026-06-26T00:00:00.000Z');
  assert.equal(result.populationContext.comparison.source.year, result.populationYear);
  assert.equal(result.populationContext.comparison.data.features.length, 18);
  assert.ok(result.shelterSources.national.data.features.length > 25);
});

test('does not silently compare population with another year', async () => {
  const api = fixtureAPI((data, url) => url.pathname.endsWith('/search')
    ? { ...data, results: [candidate(2026), comparisonCandidate(2025)] } : data);
  const result = await fetchAllData(api.fetcher);
  assert.equal(result.populationContext.comparison, null);
  assert.match(result.populationContext.unavailableReason, /ei leitud/);
  assert.equal(api.requests.some(url => url.href.startsWith(comparisonRoot)), false);
});

test('an unavailable aggregate service keeps fresh core data and an explicit missing comparison', async () => {
  const api = fixtureAPI((data, url) => url.href.startsWith(comparisonRoot)
    ? { error: { message: 'Unavailable' } } : data);
  const result = await fetchAllData(api.fetcher);
  assert.equal(result.layers.shelters.features.length, raw.layers.shelters.features.length);
  assert.equal(result.populationContext.comparison, null);
  assert.match(result.populationContext.unavailableReason, /ei saanud laadida/);
});

test('a failed national shelter download prevents publishing a city-only replacement', async () => {
  const api = fixtureAPI();
  await assert.rejects(fetchAllData((url, options) => url === NATIONAL_SHELTERS_URL
    ? Promise.resolve(new Response('Unavailable', { status: 503 })) : api.fetcher(url, options)), /503/);
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

test('a service reporting its own truncated 100-object layer passes pagination but fails the update guard', async () => {
  const api = fixtureAPI((data, url, kind) => {
    if (kind !== 'population') return data;
    if ('count' in data) data.count = 100;
    if (data.features) data.features = data.features.slice(0, 100);
    return data;
  });
  const current = { ...calculateModel(raw), updatedAt: '2020-01-01T00:00:00Z' };
  const result = await refreshIfDue(current, { fetchData: () => fetchAllData(api.fetcher), calculate: calculateModel,
    save: async () => assert.fail('Truncated source must not replace the saved map') });
  assert.equal(result.state, 'failed'); assert.equal(result.snapshot, current);
  assert.equal(result.error.name, 'DataQualityError');
  assert.ok(result.error.issues.some(i => i.key === 'source:population' && i.after === 100));
});
