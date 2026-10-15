import proj4 from 'proj4';
import { ESTONIA, NATIONAL_SHELTERS_URL } from './national-shelters.mjs';

export const SHELTER_RECONCILIATION_VERSION = 1;
const projection = proj4('EPSG:4326', ESTONIA);
const normalize = value => value.normalize('NFKC').toLocaleLowerCase('et').replace(/[.'’´]/g, '').replace(/\s+/g, ' ').trim();

// Preserve house suffixes: 11a and 11c must never become the same address.
export function addressKeys(address) {
  const streetPart = address.split(',').map(s => s.trim()).find(s => /\d/.test(s)) ?? '';
  let street = '';
  return streetPart.split(/\s*\/\/+\s*/).flatMap(part => {
    const match = normalize(part).match(/^(.*?)\s*(\d+[a-zõäöü]?(?:-\d+[a-zõäöü]?)?)$/u);
    if (!match) return [];
    if (match[1]) street = match[1].replace(/\s+tn$/, '').trim();
    return street ? [`${street} ${match[2]}`] : [];
  });
}

function distance(a, b) {
  const [x, y] = projection.forward(a.geometry.coordinates);
  const [u, v] = projection.forward(b.geometry.coordinates);
  return Math.hypot(x - u, y - v);
}

function candidate(city, national) {
  const metres = distance(city, national);
  const a = addressKeys(city.properties.Aadress ?? ''), b = addressKeys(national.properties.aadress);
  if (metres <= 150 && a.some(key => b.includes(key))) return { method: 'address-location', distanceMetres: metres };
  // Reviewed campus address alias, tied to stable IDs AND the observed addresses.
  // The separate 11c dormitory is intentionally not an alias of this point.
  if (city.properties.GlobalID?.toLowerCase() === '{592791ca-7ea0-48a4-93cf-c72b8293ba5c}' &&
      national.id === 'LÕ241' && a.includes('põllu 11') && b.includes('põllu 11a') && metres <= 40) {
    return { method: 'reviewed-address-alias', distanceMetres: metres };
  }
  return null;
}

export function reconcileShelters(cityFeatures, nationalFeatures) {
  const edges = cityFeatures.flatMap(city => nationalFeatures.flatMap(national => {
    const match = candidate(city, national);
    return match ? [{ city, national, ...match }] : [];
  }));
  const matches = edges.filter(e => edges.filter(x => x.city === e.city).length === 1 && edges.filter(x => x.national === e.national).length === 1);
  const used = new Set(matches.map(e => e.national));
  const features = cityFeatures.filter(city => city.properties.Toimiv === 1 || matches.some(e => e.city === city)).map(city => {
    const match = matches.find(e => e.city === city);
    const p = city.properties;
    const conflict = p.Toimiv !== 1;
    const audit = { status: conflict ? 'status-conflict' : match ? 'both' : edges.some(e => e.city === city) ? 'ambiguous' : 'city-only',
      stableId: `tartu:${(p.GlobalID ?? city.id).toString().toLowerCase()}`,
      city: { id: city.id, globalId: p.GlobalID ?? null, name: p.Nimetus, address: p.Aadress ?? '', capacity: p.Mahutavus, active: p.Toimiv === 1, coordinates: city.geometry.coordinates },
      national: match ? nationalRecord(match.national) : null,
      match: match ? { method: match.method, distanceMetres: match.distanceMetres } : null,
      fields: { name: 'tartu', address: 'tartu', location: 'tartu', capacity: conflict ? null : 'tartu' } };
    return { ...city, properties: { ...p, Toimiv: 1, Mahutavus: conflict ? null : p.Mahutavus, sourceAudit: audit } };
  });
  for (const national of nationalFeatures.filter(f => !used.has(f))) {
    features.push({ type: 'Feature', id: `paaste:${national.id}`, geometry: national.geometry,
      properties: { Nimetus: national.properties.nimi, Aadress: national.properties.aadress, Mahutavus: null, Toimiv: 1,
        sourceAudit: { status: edges.some(e => e.national === national) ? 'ambiguous' : 'national-only', stableId: `paaste:${national.id}`,
          city: null, national: nationalRecord(national), match: null,
          fields: { name: 'paaste', address: 'paaste', location: 'paaste', capacity: null } } } });
  }
  return features;
}

function nationalRecord(f) {
  return { id: f.id, name: f.properties.nimi, address: f.properties.aadress, coordinates: f.geometry.coordinates };
}

export function shelterContext(sources, features) {
  if (!sources) return null;
  const counts = { both: 0, 'city-only': 0, 'national-only': 0, ambiguous: 0, 'status-conflict': 0 };
  for (const f of features) counts[f.properties.sourceAudit.status]++;
  return { version: SHELTER_RECONCILIATION_VERSION, city: sources.city,
    national: Object.fromEntries(Object.entries(sources.national).filter(([key]) => !['data', 'csv'].includes(key))), counts };
}

export function validateShelterContext(context, features) {
  if (context == null) return; // Old snapshots remain usable with unavailable comparison.
  const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  if (context.version !== SHELTER_RECONCILIATION_VERSION || context.national?.url !== NATIONAL_SHELTERS_URL ||
      context.city?.url !== 'https://gis.tartulv.ee/arcgis/rest/services/Kriisijuhtimine/KR_valmisolek/FeatureServer/11' ||
      !validDate(context.city.retrievedAt) || !validDate(context.national.retrievedAt) ||
      !(context.national.modifiedAt === null || validDate(context.national.modifiedAt))) throw new Error('Varjumiskohtade allikavõrdlus ei sobi.');
  const counts = { both: 0, 'city-only': 0, 'national-only': 0, ambiguous: 0, 'status-conflict': 0 }, cityIds = new Set(), nationalIds = new Set(), stableIds = new Set();
  for (const { properties: p } of features) {
    const a = p.sourceAudit;
    if (!a || !Object.hasOwn(counts, a.status) || typeof a.stableId !== 'string' || stableIds.has(a.stableId) ||
        (!a.city && !a.national) || (['both', 'status-conflict'].includes(a.status) && (!a.city || !a.national || !a.match)) ||
        (a.status === 'city-only' && (!a.city || a.national)) || (a.status === 'national-only' && (a.city || !a.national))) throw new Error('Vigane varjumiskoha allikaseos.');
    stableIds.add(a.stableId); counts[a.status]++;
    if (a.match && (!['address-location', 'reviewed-address-alias'].includes(a.match.method) || !Number.isFinite(a.match.distanceMetres) || a.match.distanceMetres < 0 || a.match.distanceMetres > 150)) throw new Error('Vigane ühildamise alus.');
    for (const [record, ids] of [[a.city, cityIds], [a.national, nationalIds]]) {
      if (!record) continue;
      if (record.id == null || ids.has(record.id) || typeof record.name !== 'string' || typeof record.address !== 'string' ||
          !Array.isArray(record.coordinates) || record.coordinates.length !== 2 || !record.coordinates.every(Number.isFinite)) throw new Error('Korduv või vigane allikaobjekt.');
      ids.add(record.id);
    }
    if (!a.city && p.capacity !== null) throw new Error('Päästeameti CSV ei sisalda mahutavust.');
    if (a.status === 'status-conflict' ? p.capacity !== null || a.city.active !== false : a.city && (p.capacity !== a.city.capacity || !a.city.active)) throw new Error('Mahutavuse allikas ei klapi.');
  }
  if (Object.keys(counts).some(key => counts[key] !== context.counts?.[key])) throw new Error('Allikavõrdluse loendus ei klapi.');
}
