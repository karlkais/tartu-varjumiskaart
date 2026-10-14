import { checkGeometry } from './snapshot.mjs';

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
      if (item.type !== 'Feature Service' || !/rahvastik/i.test(title) || !/100\s*m/i.test(title) || !/andmed/i.test(title) || !match) continue;
      const populationYear = Number(match[1]);
      if (populationYear > year) continue;
      const url = new URL(item.url);
      if (url.origin !== 'https://gis.tartulv.ee' || !/^\/arcgis\/rest\/services\/Hosted\/.+\/FeatureServer\/?$/.test(url.pathname)) continue;
      candidates.push({ year: populationYear, url: url.href.replace(/\/$/, ''), title, itemId: item.id });
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
    if (metadata.geometryType === 'esriGeometryPolygon' && metadata.fields?.some(f => f.name === 'sum_sum_kokku')) return { ...latest, url };
  }
  throw new Error('Uusima rahvastikukihi väljad ei sobi arvutuseks.');
}

export async function downloadLayer(url, kind, fetcher = fetch) {
  const metadata = await getJSON(query(url, { f: 'json' }), fetcher);
  const idField = metadata.objectIdField ?? metadata.fields?.find(f => f.type === 'esriFieldTypeOID')?.name;
  const required = { shelters: ['Nimetus', 'Aadress', 'Mahutavus', 'Toimiv'], districts: ['NIMI'], population: ['sum_sum_kokku'], water: ['Nimi'] }[kind];
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
      if (feature.type !== 'Feature' || id == null || ids.has(id) || required.some(name => !(name in p))) throw new Error(`Puudulik või korduv objekt: ${kind}.`);
      checkGeometry(feature.geometry ?? {});
      if (kind === 'shelters' && (feature.geometry.type !== 'Point' || !Number.isFinite(p.Toimiv) || !(p.Mahutavus === null || Number.isFinite(p.Mahutavus)) || typeof p.Nimetus !== 'string')) throw new Error('Vigased varjumiskoha andmed.');
      if (kind !== 'shelters' && !['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) throw new Error(`Vigane pindobjekt: ${kind}.`);
      if (kind === 'population' && (!Number.isFinite(p.sum_sum_kokku) || p.sum_sum_kokku < 0)) throw new Error('Vigane rahvaarv.');
      ids.add(id);
      features.push({ ...feature, id });
    }
  }
  const finalCount = (await getJSON(countURL, fetcher)).count;
  if (features.length !== count || finalCount !== count) throw new Error(`Andmekiht muutus laadimise ajal: ${kind}.`);
  return { type: 'FeatureCollection', features };
}

export async function fetchAllData(fetcher = fetch) {
  const population = await discoverPopulation(fetcher);
  const urls = { ...SOURCES, population: population.url };
  const entries = await Promise.all(Object.entries(urls).map(async ([kind, url]) => [kind, await downloadLayer(url, kind, fetcher)]));
  return {
    populationYear: population.year,
    sources: { ...urls, populationTitle: population.title, populationItemId: population.itemId },
    layers: Object.fromEntries(entries)
  };
}
