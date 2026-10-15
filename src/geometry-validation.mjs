// Broad service-area bounds, including Tartu's western settlements. Not a city boundary.
export const TARTU_SOURCE_BOUNDS = [26.2, 58.1, 27.1, 58.7];
export const TARTU_MAP_BOUNDS = [26.55, 58.25, 26.95, 58.5];
export const POLYGONS = ['Polygon', 'MultiPolygon'];
export const validId = id => (typeof id === 'string' && id.trim().length > 0) || (Number.isSafeInteger(id) && id >= 0);
export const nonempty = text => typeof text === 'string' && text.trim().length > 0;
export const nonnegative = value => Number.isFinite(value) && value >= 0;

export function checkGeometry(geometry, { types, bounds = [-180, -90, 180, 90] } = {}) {
  if (!geometry || (types && !types.includes(geometry.type))) throw new Error('Andmekihi geomeetriatüüp ei sobi.');
  const fail = () => { throw new Error('Vigane geomeetriastruktuur või piirkond.'); };
  const position = c => {
    if (!Array.isArray(c) || c.length < 2 || c.length > 3 || !c.every(Number.isFinite) ||
        c[0] < bounds[0] || c[0] > bounds[2] || c[1] < bounds[1] || c[1] > bounds[3]) fail();
  };
  const list = (values, check, min = 1) => {
    if (!Array.isArray(values) || values.length < min) fail();
    values.forEach(check);
  };
  const line = points => list(points, position, 2);
  const ring = points => {
    list(points, position, 4);
    if (points[0].length !== points.at(-1).length || points[0].some((v, i) => v !== points.at(-1)[i]) ||
        new Set(points.slice(0, -1).map(c => `${c[0]},${c[1]}`)).size < 3) fail();
  };
  const polygon = rings => list(rings, ring);
  switch (geometry.type) {
    case 'Point': position(geometry.coordinates); break;
    case 'MultiPoint': list(geometry.coordinates, position); break;
    case 'LineString': line(geometry.coordinates); break;
    case 'MultiLineString': list(geometry.coordinates, line); break;
    case 'Polygon': polygon(geometry.coordinates); break;
    case 'MultiPolygon': list(geometry.coordinates, polygon); break;
    case 'GeometryCollection': list(geometry.geometries, g => checkGeometry(g, { bounds })); break;
    default: fail();
  }
}

export function validateSourceFeature(f, kind) {
  if (f?.type !== 'Feature' || !validId(f.id) || !f.properties || typeof f.properties !== 'object' || Array.isArray(f.properties)) throw new Error(`Vigane lähteobjekt: ${kind}.`);
  const p = f.properties;
  checkGeometry(f.geometry, { types: kind === 'shelters' ? ['Point'] : POLYGONS, bounds: TARTU_SOURCE_BOUNDS });
  if (kind === 'shelters' && (!nonempty(p.Nimetus) || !nonempty(p.Aadress) || ![0, 1, 2].includes(p.Toimiv) ||
      !(p.Mahutavus === null || (Number.isSafeInteger(p.Mahutavus) && p.Mahutavus >= 0)))) throw new Error('Vigased varjumiskoha väljad.');
  if (['population', 'populationTotals'].includes(kind) && !nonnegative(p.sum_sum_kokku)) throw new Error('Vigane rahvaarv.');
  if (kind === 'districts' && !nonempty(p.NIMI)) throw new Error('Linnaosa nimi puudub.');
  if (kind === 'populationTotals' && !nonempty(p.nimi)) throw new Error('Linnaosa nimi puudub.');
  if (kind === 'water' && !(p.Nimi === null || typeof p.Nimi === 'string')) throw new Error('Veekogu nimi ei sobi.');
}

export function validateRawLayers(raw) {
  for (const kind of ['shelters', 'districts', 'population', 'water']) {
    const layer = raw.layers?.[kind];
    if (layer?.type !== 'FeatureCollection' || !Array.isArray(layer.features) || !layer.features.length) throw new Error(`Puudulik lähtekiht: ${kind}.`);
    const ids = new Set(), names = new Set(), globalIds = new Set();
    for (const f of layer.features) {
      validateSourceFeature(f, kind);
      const id = String(f.id);
      if (ids.has(id)) throw new Error(`Korduv lähteobjekti tunnus: ${kind}.`);
      ids.add(id);
      if (kind === 'districts') {
        const name = f.properties.NIMI.trim().toLocaleLowerCase('et');
        if (names.has(name)) throw new Error('Linnaosade nimed korduvad.');
        names.add(name);
      }
      if (f.properties.GlobalID != null) {
        const gid = String(f.properties.GlobalID).toLowerCase();
        if (!nonempty(gid) || globalIds.has(gid)) throw new Error(`Korduv GlobalID: ${kind}.`);
        globalIds.add(gid);
      }
    }
  }
  if (raw.shelterSources != null) {
    const layer = raw.shelterSources.national?.data, ids = new Set();
    if (layer?.type !== 'FeatureCollection' || !Array.isArray(layer.features) || !layer.features.length) throw new Error('Päästeameti lähtekiht puudub.');
    for (const f of layer.features) {
      if (f.type !== 'Feature' || !validId(f.id) || ids.has(String(f.id)) || !nonempty(f.properties?.nimi) ||
          !nonempty(f.properties?.aadress) || f.properties.tyyp !== 'Varjumiskoht') throw new Error('Vigane või korduv Päästeameti lähteobjekt.');
      ids.add(String(f.id));
      checkGeometry(f.geometry, { types: ['Point'], bounds: [21, 57, 29, 60.5] });
    }
  }
}
