import { validatePopulationContext } from './population-context.mjs';
import { validateShelterContext } from './shelter-reconciliation.mjs';
import { checkGeometry, TARTU_MAP_BOUNDS, POLYGONS, validId, nonempty } from './geometry-validation.mjs';
import { polygonArea, validateQuality, validateUpdate } from './data-quality.mjs';
export { checkGeometry } from './geometry-validation.mjs';

export const SCHEMA_VERSION = 1;
export const MODEL_VERSION = 'nearest-3301-v1';

// Six calendar months, preserving UTC time and clamping the day at month end.
export function nextUpdateAt(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) throw new Error('Uuendamise kuupäev puudub.');
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 6);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.getTime();
}

export function isUpdateDue(snapshot, now = Date.now()) {
  return now > nextUpdateAt(snapshot.updatedAt);
}

export function validateSnapshot(value, now = Date.now()) {
  if (!value || value.schemaVersion !== SCHEMA_VERSION || value.modelVersion !== MODEL_VERSION ||
      typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt)) ||
      Date.parse(value.updatedAt) > now + 300_000 ||
      !Number.isInteger(value.populationYear) || !value.sources) {
    throw new Error('Salvestatud andmete versioon või kuupäev ei sobi.');
  }
  for (const key of ['districts', 'water', 'population', 'shelters']) {
    const layer = value.layers?.[key];
    if (layer?.type !== 'FeatureCollection' || !Array.isArray(layer.features) || !layer.features.length) {
      throw new Error(`Puudulik andmekiht: ${key}.`);
    }
    for (const feature of layer.features) {
      if (feature.type !== 'Feature' || !feature.geometry || !feature.properties || typeof feature.properties !== 'object') {
        throw new Error(`Vigane kaardiobjekt: ${key}.`);
      }
      checkGeometry(feature.geometry, { types: key === 'shelters' ? ['Point'] : POLYGONS, bounds: TARTU_MAP_BOUNDS });
      if (key !== 'shelters' && !(polygonArea(feature.geometry) > 0)) throw new Error(`Pindala puudub: ${key}.`);
    }
    // Old published snapshots omitted district/water IDs. New snapshots must retain them.
    const legacyIds = !value.quality && ['districts', 'water'].includes(key) && layer.features.every(f => f.properties.id === undefined);
    if (!legacyIds) uniqueIds(layer.features, key);
  }
  const names = value.layers.districts.features.map(f => f.properties.name);
  if (names.some(n => !nonempty(n)) || new Set(names.map(n => n.trim().toLocaleLowerCase('et'))).size !== names.length) throw new Error('Linnaosade nimed puuduvad või korduvad.');
  const targets = new Map();
  let assigned = 0;
  for (const { properties: p, geometry } of value.layers.shelters.features) {
    if (geometry.type !== 'Point' || !nonempty(p.name) || !nonempty(p.address) ||
        !(p.capacity === null || (Number.isSafeInteger(p.capacity) && p.capacity >= 0))) throw new Error('Vigane varjumiskoht.');
    if (p.capacity > 0) {
      if (!Number.isFinite(p.assigned) || p.assigned < 0 || !Number.isFinite(p.ratio) ||
          Math.abs(p.ratio - p.assigned / p.capacity) > 1e-9 ||
          p.category !== (p.ratio < 0.75 ? 'low' : p.ratio <= 1.25 ? 'balanced' : 'high')) throw new Error('Vigane koormusarvutus.');
      assigned += p.assigned;
      targets.set(p.id, { assigned: p.assigned, residents: 0 });
    } else if (p.category !== 'unknown' || p.assigned !== null || p.ratio !== null) throw new Error('Vigane teadmata mahutavusega varjumiskoht.');
  }
  let residents = 0;
  for (const { properties: p } of value.layers.population.features) {
    if (!Number.isFinite(p.residents) || p.residents <= 0 || !targets.has(p.shelterId)) throw new Error('Vigane rahvastikuarvutus või mahutavuseta sihtkoht.');
    residents += p.residents;
    targets.get(p.shelterId).residents += p.residents;
  }
  for (const [id, target] of targets) if (Math.abs(target.assigned - target.residents) > .01) throw new Error(`Varjumiskoha ${id} elanike kontrollsumma ei klapi.`);
  if (Math.abs(assigned - residents) > 0.01) throw new Error('Rahvaarvu kontrollsumma ei klapi.');
  validatePopulationContext(value.populationContext, value.populationYear, residents);
  validateShelterContext(value.shelterContext, value.layers.shelters.features);
  if (value.layers.zeroPopulation != null) {
    const zero = value.layers.zeroPopulation;
    if (zero.type !== 'FeatureCollection' || !Array.isArray(zero.features)) throw new Error('Nullrahvastiku kiht ei sobi.');
    for (const f of zero.features) {
      if (f.type !== 'Feature' || f.properties?.residents !== 0 || !['Polygon', 'MultiPolygon'].includes(f.geometry?.type)) throw new Error('Nullrahvastiku ala ei sobi.');
      checkGeometry(f.geometry, { types: POLYGONS, bounds: TARTU_MAP_BOUNDS });
      if (!(polygonArea(f.geometry) > 0)) throw new Error('Nullrahvastiku pindala puudub.');
    }
    uniqueIds([...value.layers.population.features, ...zero.features], 'population');
  }
  validateQuality(value.quality, value);
  return value;
}

function uniqueIds(features, layer) {
  const ids = new Set();
  for (const f of features) {
    const id = f.properties?.id;
    if (!validId(id) || ids.has(String(id))) throw new Error(`Objektide tunnused puuduvad või korduvad: ${layer}.`);
    ids.add(String(id));
  }
}

export function newestSnapshot(candidates, now = Date.now()) {
  return candidates.filter(value => {
    try { validateSnapshot(value, now); return true; } catch { return false; }
  }).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) ||
    Number(Boolean(b.quality)) - Number(Boolean(a.quality)) ||
    Number(Boolean(b.shelterContext)) - Number(Boolean(a.shelterContext)) ||
    Number(Boolean(b.populationContext?.comparison)) - Number(Boolean(a.populationContext?.comparison)))[0] ?? null;
}

// Failed downloads/calculations never replace the old snapshot or its timestamp.
export async function refreshIfDue(current, { fetchData, calculate, save, now = () => Date.now() }) {
  if (!isUpdateDue(current, now())) return { snapshot: current, state: 'fresh' };
  let next;
  try {
    const raw = await fetchData();
    if (raw.populationYear < current.populationYear) throw new Error('Uuem rahvastikukiht pole kättesaadav.');
    next = validateSnapshot({ ...await calculate(raw), updatedAt: new Date(now()).toISOString() }, now());
    validateUpdate(current, next);
  } catch (error) {
    return { snapshot: current, state: 'failed', error };
  }
  try {
    await save(next);
    return { snapshot: next, state: 'updated' };
  } catch (error) {
    return { snapshot: next, state: 'unsaved', error };
  }
}
