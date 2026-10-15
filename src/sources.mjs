import { validateSourceFeature } from './geometry-validation.mjs';
import { fetchNationalShelters } from './national-shelters.mjs';

const BASE = 'https://gis.tartulv.ee/arcgis/rest/services/';
export const SOURCES = {
  shelters: `${BASE}Kriisijuhtimine/KR_valmisolek/FeatureServer/11`,
  districts: `${BASE}Aluskaardid/KT_haldusjaotus/FeatureServer/1`,
  water: `${BASE}Aluskaardid/KT_veekogud/FeatureServer/0`
};
const PORTAL = 'https://gis.tartulv.ee/portal/sharing/rest/search';

export async function getJSON(url, fetcher = fetch) {
  const response = await fetcher(url, { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(45_000) });
  if (!response.ok) throw new Error(`Andmeteenuse vastus: ${response.status}.`);
  const data = await response.json();
  if (data.error) throw new Error(`Andmeteenus: ${data.error.message ?? 'päring ebaõnnestus'}.`);
  return data;
}

function query(url, parameters) { return `${url}?${new URLSearchParams(parameters)}`; }

export async function discoverPopulation(fetcher = fetch, year = new Date().getUTCFullYear()) {
  const candidates = [];
  const comparisons = [];
  let start = 1;
  const visited = new Set();
  while (start > 0) {
    if (visited.has(start) || visited.size > 20) throw new Error('Andmekataloogi leheküljed korduvad.');
    visited.add(start);
    const page = await getJSON(query(PORTAL, { f: 'json', q: 'rahvastik*', num: 100, start }), fetcher);
    if (!Array.isArray(page.results)) throw new Error('Rahvastiku andmekataloog pole kättesaadav.');
    for (const item of page.results) {
      const title = item.title ?? '';
      const match = title.match(/(?:^|[^0-9])(20\d{2})(?:[^0-9]|$)/);
      if (item.type !== 'Feature Service' || !/rahvastik/i.test(title) || !/andmed/i.test(title) || !match) continue;
      const populationYear = Number(match[1]);
      if (populationYear > year) continue;
      let url;
      try { url = new URL(item.url); } catch { continue; }
      if (url.origin !== 'https://gis.tartulv.ee' || !/^\/arcgis\/rest\/services\/Hosted\/.+\/FeatureServer\/?$/.test(url.pathname)) continue;
      const candidate = { year: populationYear, url: url.href.replace(/\/$/, ''), title, itemId: item.id,
        description: typeof item.description === 'string' ? item.description : '',
        snippet: typeof item.snippet === 'string' ? item.snippet : '',
        modifiedAt: Number.isFinite(item.modified) ? new Date(item.modified).toISOString() : null };
      if (/100\s*m/i.test(title)) candidates.push(candidate);
      else if (/linnaosa/i.test(title)) comparisons.push(candidate);
    }
    if (!Number.isInteger(page.nextStart)) throw new Error('Puudulik andmekataloogi vastus.');
    start = page.nextStart;
  }
  candidates.sort((a, b) => b.year - a.year || a.url.localeCompare(b.url));
  const latest = candidates[0];
  if (!latest) throw new Error('Rahvastiku 100 m andmekihti ei leitud.');
  const service = await getJSON(query(latest.url, { f: 'json' }), fetcher);
  if (!Array.isArray(service.layers)) throw new Error('Rahvastikuteenuse kihid puuduvad.');
  for (const layer of service.layers) {
    const url = `${latest.url}/${layer.id}`;
    const metadata = await getJSON(query(url, { f: 'json' }), fetcher);
    if (metadata.geometryType === 'esriGeometryPolygon' && metadata.fields?.some(f => f.name === 'sum_sum_kokku')) {
      const comparison = comparisons.filter(item => item.year === latest.year).sort((a, b) => a.url.localeCompare(b.url))[0] ?? null;
      return { ...latest, url, comparison };
    }
  }
  throw new Error('Uusima rahvastikukihi väljad ei sobi arvutuseks.');
}

export async function downloadLayer(url, kind, fetcher = fetch) {
  const metadata = await getJSON(query(url, { f: 'json' }), fetcher);
  const idField = metadata.objectIdField ?? metadata.fields?.find(f => f.type === 'esriFieldTypeOID')?.name;
  const required = { shelters: ['Nimetus', 'Aadress', 'Mahutavus', 'Toimiv'], districts: ['NIMI'], population: ['sum_sum_kokku'], populationTotals: ['nimi', 'sum_sum_kokku'], water: ['Nimi'] }[kind];
  if (!idField || !required || required.some(name => !metadata.fields?.some(f => f.name === name))) throw new Error(`Andmekihi väljad muutusid: ${kind}.`);
  const countURL = query(`${url}/query`, { f: 'json', where: '1=1', returnCountOnly: true });
  const { count } = await getJSON(countURL, fetcher);
  if (!Number.isInteger(count) || count < 1 || count > 100_000) throw new Error(`Ootamatu objektide arv: ${kind}.`);
  const pageSize = Math.min(metadata.maxRecordCount || 1000, 1000);
  const features = [];
  const ids = new Set();
  while (features.length < count) {
    const page = await getJSON(query(`${url}/query`, {
      f: 'geojson', where: '1=1', outFields: '*', outSR: 4326,
      orderByFields: `${idField} ASC`, resultRecordCount: pageSize, resultOffset: features.length
    }), fetcher);
    if (page.type !== 'FeatureCollection' || !Array.isArray(page.features) || !page.features.length) throw new Error(`Andmekihi laadimine katkes: ${kind}.`);
    for (const feature of page.features) {
      const p = feature.properties;
      const id = p?.[idField];
      if (feature.type !== 'Feature' || id == null || ids.has(String(id)) || required.some(name => !(name in p))) throw new Error(`Puudulik või korduv objekt: ${kind}.`);
      validateSourceFeature({ ...feature, id }, kind);
      ids.add(String(id));
      features.push({ ...feature, id });
    }
  }
  const finalCount = (await getJSON(countURL, fetcher)).count;
  if (features.length !== count || finalCount !== count) throw new Error(`Andmekiht muutus laadimise ajal: ${kind}.`);
  return { type: 'FeatureCollection', features };
}

function sourceMetadata(candidate) {
  const { year, url, title, itemId, description, snippet, modifiedAt } = candidate;
  return { year, url, title, itemId, description, snippet, modifiedAt, retrievedAt: new Date().toISOString() };
}

export async function fetchPopulationContext(population, fetcher = fetch) {
  const context = { source: sourceMetadata(population), comparison: null,
    unavailableReason: 'Sama aasta linnaosade koondandmeid ei leitud.' };
  if (!population.comparison) return context;
  try {
    const candidate = population.comparison;
    if (candidate.year !== population.year) throw new Error('Võrdlusaastad ei ühti.');
    const service = await getJSON(query(candidate.url, { f: 'json' }), fetcher);
    for (const layer of service.layers ?? []) {
      const url = `${candidate.url}/${layer.id}`;
      const metadata = await getJSON(query(url, { f: 'json' }), fetcher);
      if (metadata.geometryType !== 'esriGeometryPolygon' ||
          !['nimi', 'sum_sum_kokku'].every(name => metadata.fields?.some(f => f.name === name))) continue;
      const data = await downloadLayer(url, 'populationTotals', fetcher);
      return { ...context, comparison: { source: sourceMetadata({ ...candidate, url }), data }, unavailableReason: null };
    }
    throw new Error('Võrdluskihi väljad puuduvad.');
  } catch {
    // An unavailable comparison must not block fresh shelter data or imply full coverage.
    return { ...context, unavailableReason: 'Sama aasta linnaosade koondandmeid ei saanud laadida.' };
  }
}

export async function fetchAllData(fetcher = fetch) {
  const population = await discoverPopulation(fetcher);
  const urls = { ...SOURCES, population: population.url };
  const [entries, populationContext, national] = await Promise.all([
    Promise.all(Object.entries(urls).map(async ([kind, url]) => [kind, await downloadLayer(url, kind, fetcher)])),
    fetchPopulationContext(population, fetcher),
    fetchNationalShelters(fetcher)
  ]);
  return {
    populationYear: population.year,
    sources: { ...urls, populationTitle: population.title, populationItemId: population.itemId },
    populationContext,
    shelterSources: { city: { url: SOURCES.shelters, retrievedAt: new Date().toISOString() }, national },
    layers: Object.fromEntries(entries)
  };
}
