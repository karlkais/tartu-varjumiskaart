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
      if (feature.type !== 'Feature' || !feature.geometry || !feature.properties) {
        throw new Error(`Vigane kaardiobjekt: ${key}.`);
      }
      checkGeometry(feature.geometry);
    }
  }
  const ids = new Set(value.layers.shelters.features.map(f => f.properties.id));
  if (ids.size !== value.layers.shelters.features.length || ids.has(undefined)) throw new Error('Varjumiskohtade tunnused korduvad.');
  let assigned = 0;
  for (const { properties: p, geometry } of value.layers.shelters.features) {
    if (geometry.type !== 'Point' || typeof p.name !== 'string' ||
        !(p.capacity === null || Number.isFinite(p.capacity))) throw new Error('Vigane varjumiskoht.');
    if (p.capacity > 0) {
      if (!Number.isFinite(p.assigned) || p.assigned < 0 || !Number.isFinite(p.ratio) ||
          Math.abs(p.ratio - p.assigned / p.capacity) > 1e-9 ||
          p.category !== (p.ratio < 0.75 ? 'low' : p.ratio <= 1.25 ? 'balanced' : 'high')) throw new Error('Vigane koormusarvutus.');
      assigned += p.assigned;
    } else if (p.category !== 'unknown' || p.assigned !== null || p.ratio !== null) throw new Error('Vigane teadmata mahutavusega varjumiskoht.');
  }
  let residents = 0;
  for (const { properties: p } of value.layers.population.features) {
    if (!Number.isFinite(p.residents) || p.residents <= 0 || !ids.has(p.shelterId)) throw new Error('Vigane rahvastikuarvutus.');
    residents += p.residents;
  }
  if (Math.abs(assigned - residents) > 0.01) throw new Error('Rahvaarvu kontrollsumma ei klapi.');
  return value;
}

export function checkGeometry(geometry) {
  if (geometry.type === 'GeometryCollection') {
    if (!geometry.geometries?.length) throw new Error('Tühi geomeetria.');
    geometry.geometries.forEach(checkGeometry);
    return;
  }
  if (!['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(geometry.type)) throw new Error('Tundmatu geomeetria.');
  function visit(coords) {
    if (!Array.isArray(coords) || !coords.length) throw new Error('Tühi geomeetria.');
    if (typeof coords[0] === 'number') {
      if (coords.length < 2 || !coords.every(Number.isFinite) || Math.abs(coords[0]) > 180 || Math.abs(coords[1]) > 90) throw new Error('Vigased koordinaadid.');
    } else coords.forEach(visit);
  }
  visit(geometry.coordinates);
}

export function newestSnapshot(candidates, now = Date.now()) {
  return candidates.filter(value => {
    try { validateSnapshot(value, now); return true; } catch { return false; }
  }).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0] ?? null;
}

// Failed downloads/calculations never replace the old snapshot or its timestamp.
export async function refreshIfDue(current, { fetchData, calculate, save, now = () => Date.now() }) {
  if (!isUpdateDue(current, now())) return { snapshot: current, state: 'fresh' };
  let next;
  try {
    const raw = await fetchData();
    if (raw.populationYear < current.populationYear) throw new Error('Uuem rahvastikukiht pole kättesaadav.');
    next = validateSnapshot({ ...await calculate(raw), updatedAt: new Date(now()).toISOString() }, now());
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
