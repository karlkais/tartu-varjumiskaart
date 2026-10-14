import { checkGeometry, isUpdateDue } from './snapshot.mjs';
import { getJSON } from './sources.mjs';

export const ETAK_URL = 'https://gsavalik.envir.ee/geoserver/etak/wfs';
export const BASEMAP_VERSION = 1;
export const BASEMAP_LAYERS = {
  woodland: { name: 'e_305_puittaimestik_a', geometry: 'Polygon', fields: [] },
  lakes: { name: 'e_202_seisuveekogu_a', geometry: 'Polygon', fields: ['nimetus'] },
  rivers: { name: 'e_203_vooluveekogu_a', geometry: 'Polygon', fields: ['nimetus'] },
  buildings: { name: 'e_401_hoone_ka', geometry: 'Polygon', fields: [] },
  roads: { name: 'e_501_tee_j', geometry: 'LineString', fields: ['nimetus', 'ads_nimetus', 'karto_nimi', 'laius', 'tahtsus', 'tyyp'] },
  railways: { name: 'e_502_roobastee_j', geometry: 'LineString', fields: [] }
};
const CRS84 = 'urn:ogc:def:crs:OGC:1.3:CRS84';
const PAGE_SIZE = 1000;

// About three kilometres of context around the city, independent of map zoom.
export function basemapBounds(districts) {
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  function visit(coords) {
    if (typeof coords[0] === 'number') {
      bounds[0] = Math.min(bounds[0], coords[0]); bounds[1] = Math.min(bounds[1], coords[1]);
      bounds[2] = Math.max(bounds[2], coords[0]); bounds[3] = Math.max(bounds[3], coords[1]);
    } else coords.forEach(visit);
  }
  districts.features.forEach(f => { checkGeometry(f.geometry); visit(f.geometry.coordinates); });
  return validateBounds(bounds.map((v, i) => Number((v + (i < 2 ? -1 : 1) * (i % 2 ? .027 : .052)).toFixed(6))));
}

function validateBounds(bounds) {
  if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isFinite) ||
      bounds[0] < 26.4 || bounds[2] > 27.1 || bounds[1] < 58.1 || bounds[3] > 58.6 ||
      bounds[0] >= bounds[2] || bounds[1] >= bounds[3]) throw new Error('Aluskaardi piirkond ei sobi Tartule.');
  return bounds;
}

function compactFeature(feature, definition) {
  const p = feature.properties;
  if (!Number.isInteger(p?.fid) || definition.fields.some(key => !(key in p)) ||
      ![definition.geometry, `Multi${definition.geometry}`].includes(feature.geometry?.type)) throw new Error('ETAK andmekihi väljad või geomeetria muutusid.');
  checkGeometry(feature.geometry);
  const round = coords => typeof coords[0] === 'number'
    ? coords.slice(0, 2).map(v => Number(v.toFixed(6))) : coords.map(round);
  const properties = {};
  if (definition.fields.includes('nimetus')) {
    properties.name = String(p.karto_nimi || p.ads_nimetus || p.nimetus || '').trim();
  }
  if (definition.fields.includes('laius')) {
    properties.width = Number.isFinite(p.laius) && p.laius > 0 ? p.laius : 3;
    properties.importance = Number.isFinite(p.tahtsus) ? p.tahtsus : 0;
    properties.kind = Number.isFinite(p.tyyp) ? p.tyyp : 0;
  }
  return { type: 'Feature', id: p.fid, properties, geometry: { type: feature.geometry.type, coordinates: round(feature.geometry.coordinates) } };
}

export async function downloadBasemapLayer(kind, bounds, fetcher = fetch, progress = () => {}) {
  const definition = BASEMAP_LAYERS[kind];
  if (!definition) throw new Error('Tundmatu aluskaardikiht.');
  validateBounds(bounds);
  const features = [];
  let lastId = -Infinity, reportedCount;
  // numberMatched/hits is capped at 5000, so continue beyond it. Overlap one
  // feature to detect shifted pages and avoid the server's empty-page error.
  for (let pageIndex = 0; pageIndex <= 101; pageIndex++) {
    const parameters = {
      service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: `etak:${definition.name}`,
      outputFormat: 'application/json', srsName: CRS84, bbox: `${bounds.join(',')},${CRS84}`,
      propertyName: ['fid', 'shape', ...definition.fields].join(','),
      count: PAGE_SIZE, startIndex: Math.max(0, features.length - 1), sortBy: 'fid A'
    };
    const page = await getJSON(`${ETAK_URL}?${new URLSearchParams(parameters)}`, fetcher);
    if (page.type !== 'FeatureCollection' || !Array.isArray(page.features) ||
        (page.numberReturned != null && page.numberReturned !== page.features.length)) throw new Error(`Aluskaardi laadimine katkes: ${kind}.`);
    if (typeof page.numberMatched === 'number') {
      reportedCount ??= page.numberMatched;
      if (page.numberMatched !== reportedCount) throw new Error(`Aluskaardi objektide arv muutus laadimise ajal: ${kind}.`);
    }
    if (!page.features.length) throw new Error(`Aluskaardi kiht on tühi või poolik: ${kind}.`);
    const overlap = features.length ? 1 : 0;
    if (overlap && page.features[0].properties?.fid !== lastId) throw new Error(`Aluskaardi lehekülgede piir muutus: ${kind}.`);
    for (const feature of page.features.slice(overlap)) {
      const compact = compactFeature(feature, definition);
      if (compact.id <= lastId) throw new Error(`Aluskaardi leheküljed korduvad või järjekord muutus: ${kind}.`);
      lastId = compact.id; features.push(compact);
    }
    progress(kind, features.length);
    if (page.features.length < PAGE_SIZE) {
      if (reportedCount != null && features.length < reportedCount) throw new Error(`Aluskaardi kiht on poolik: ${kind}.`);
      return { type: 'FeatureCollection', features };
    }
  }
  throw new Error(`Aluskaardi maht ületab lubatud piiri: ${kind}.`);
}

export async function fetchBasemap(districts, { fetcher = fetch, progress, now = () => Date.now() } = {}) {
  const bounds = basemapBounds(districts);
  const layers = {};
  // One request at a time keeps this occasional refresh gentle on the public WFS.
  for (const key of Object.keys(BASEMAP_LAYERS)) layers[key] = await downloadBasemapLayer(key, bounds, fetcher, progress);
  return validateBasemap({ version: BASEMAP_VERSION, source: ETAK_URL, updatedAt: new Date(now()).toISOString(), bounds, layers }, now());
}

export function validateBasemap(value, now = Date.now()) {
  if (value?.version !== BASEMAP_VERSION || value.source !== ETAK_URL || typeof value.updatedAt !== 'string' ||
      !Number.isFinite(Date.parse(value.updatedAt)) || Date.parse(value.updatedAt) > now + 300_000) throw new Error('Aluskaardi versioon või kuupäev ei sobi.');
  validateBounds(value.bounds);
  for (const [key, definition] of Object.entries(BASEMAP_LAYERS)) {
    const layer = value.layers?.[key];
    if (layer?.type !== 'FeatureCollection' || !Array.isArray(layer.features) || !layer.features.length || layer.features.length > 100_000) throw new Error(`Aluskaardi kiht puudub: ${key}.`);
    const ids = new Set();
    for (const feature of layer.features) {
      if (feature.type !== 'Feature' || !Number.isInteger(feature.id) || ids.has(feature.id) || !feature.properties ||
          ![definition.geometry, `Multi${definition.geometry}`].includes(feature.geometry?.type)) throw new Error(`Vigane aluskaardi objekt: ${key}.`);
      if (definition.fields.includes('nimetus') && typeof feature.properties.name !== 'string') throw new Error('Aluskaardi kohanimi puudub.');
      if (key === 'roads' && (!Number.isFinite(feature.properties.width) || !Number.isFinite(feature.properties.importance) || !Number.isFinite(feature.properties.kind))) throw new Error('Aluskaardi tee omadused puuduvad.');
      checkGeometry(feature.geometry); ids.add(feature.id);
    }
  }
  return value;
}

export function newestBasemap(candidates, now = Date.now()) {
  return candidates.filter(value => { try { validateBasemap(value, now); return true; } catch { return false; } })
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0] ?? null;
}

export async function refreshBasemapIfDue(current, { fetchData, save, now = () => Date.now() }) {
  if (current && !isUpdateDue(current, now())) return { snapshot: current, state: 'fresh' };
  let next;
  try {
    next = validateBasemap({ ...await fetchData(), updatedAt: new Date(now()).toISOString() }, now());
    // A silently truncated response should not replace a working regional map.
    if (current) for (const key of Object.keys(BASEMAP_LAYERS)) {
      if (next.layers[key].features.length < current.layers[key].features.length * .6) throw new Error(`Aluskaardi objektide arv vähenes ootamatult: ${key}.`);
    }
  } catch (error) { return { snapshot: current, state: 'failed', error }; }
  try { await save(next); return { snapshot: next, state: 'updated' }; }
  catch (error) { return { snapshot: next, state: 'unsaved', error }; }
}
