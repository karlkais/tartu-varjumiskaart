import proj4 from 'proj4';
import { ESTONIA } from './national-shelters.mjs';

export const QUALITY_VERSION = 1;
const projection = proj4('EPSG:4326', ESTONIA);
const sum = (features, key) => features.reduce((total, f) => total + (f.properties[key] ?? 0), 0);

// Ring areas in EPSG:3301, with holes subtracted. Shifting the origin avoids cancellation.
export function polygonArea(geometry) {
  const ringArea = ring => {
    const coordinates = ring.map(c => projection.forward(c.slice(0, 2))), origin = coordinates[0];
    let twice = 0;
    for (let i = 1; i < coordinates.length; i++) {
      const a = coordinates[i - 1], b = coordinates[i];
      twice += (a[0] - origin[0]) * (b[1] - origin[1]) - (b[0] - origin[0]) * (a[1] - origin[1]);
    }
    return Math.abs(twice) / 2;
  };
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.reduce((area, rings) => area + ringArea(rings[0]) - rings.slice(1).reduce((n, r) => n + ringArea(r), 0), 0);
}

export function snapshotMetrics(snapshot) {
  const l = snapshot.layers;
  return { populationCells: l.population.features.length + (l.zeroPopulation?.features.length ?? 0),
    residents: sum(l.population.features, 'residents'), shelters: l.shelters.features.length,
    knownShelters: l.shelters.features.filter(f => f.properties.capacity > 0).length, capacity: sum(l.shelters.features, 'capacity'),
    water: l.water.features.length,
    districts: l.districts.features.map(f => ({ name: f.properties.name, area: polygonArea(f.geometry) })) };
}

export function validateQuality(quality, snapshot) {
  if (quality == null) return;
  if (quality.version !== QUALITY_VERSION || !quality.sources || !Array.isArray(quality.districts)) throw new Error('Andmekvaliteedi mõõdikud puuduvad.');
  const expected = snapshotMetrics(snapshot), byName = new Map(expected.districts.map(d => [d.name, d]));
  const names = new Set(); let residents = 0;
  for (const row of quality.districts) {
    if (names.has(row.name) || !byName.has(row.name) || ![row.area, row.residents, row.populationArea].every(v => Number.isFinite(v) && v >= 0) ||
        Math.abs(row.area - byName.get(row.name).area) > Math.max(1, row.area * 1e-7) || row.populationArea > row.area * 1.001) throw new Error('Linnaosa katvuse mõõdikud ei sobi.');
    names.add(row.name); residents += row.residents;
  }
  if (names.size !== byName.size || Math.abs(residents - expected.residents) > .1) throw new Error('Linnaosade rahvaarvu kontrollsumma ei klapi.');
  for (const key of ['population', 'shelters', 'districts', 'water', 'nationalShelters']) {
    const count = quality.sources[key];
    if (!(Number.isSafeInteger(count) && count >= 0)) throw new Error('Lähtekihi mahu mõõdik ei sobi.');
  }
  if (!Number.isFinite(quality.sources.residents) || quality.sources.residents < expected.residents - .01 ||
      quality.sources.population < expected.populationCells || quality.sources.districts !== names.size) throw new Error('Lähteandmete kontrollsummad ei klapi.');
}

export class DataQualityError extends Error {
  constructor(issues) {
    super(`Andmeuuendus vajab ülevaatust: ${issues.slice(0, 3).map(i => i.message).join(' ')}`);
    this.name = 'DataQualityError'; this.issues = issues;
  }
}

// Engineering review thresholds, not official estimates of possible real-world change.
export function updateIssues(previous, next) {
  const before = snapshotMetrics(previous), after = snapshotMetrics(next), issues = [];
  const compare = (key, label, a, b, low, high) => {
    if ((a === 0 && b > 0) || (a > 0 && (b / a < low || b / a > high))) {
      issues.push({ key, before: a, after: b, minimumRatio: low, maximumRatio: high,
        message: `${label}: ${Number(a.toFixed(2))} → ${Number(b.toFixed(2))}.` });
    }
  };
  compare('populationCells', 'Rahvastikualade arv', before.populationCells, after.populationCells, .8, 1.5);
  compare('residents', 'Elanike summa', before.residents, after.residents, .85, 1.25);
  compare('shelters', 'Varjumiskohtade arv', before.shelters, after.shelters, .8, 1.5);
  compare('knownShelters', 'Mahutavusega kohtade arv', before.knownShelters, after.knownShelters, .8, 1.5);
  compare('capacity', 'Mahutavuste summa', before.capacity, after.capacity, .75, 1.5);
  compare('water', 'Veekogude arv', before.water, after.water, .5, 2);
  const oldDistricts = new Map(before.districts.map(d => [d.name, d])), newDistricts = new Map(after.districts.map(d => [d.name, d]));
  if (oldDistricts.size !== newDistricts.size || [...oldDistricts.keys()].some(name => !newDistricts.has(name))) {
    issues.push({ key: 'districts', message: 'Linnaosade koosseis muutus.', before: [...oldDistricts.keys()], after: [...newDistricts.keys()] });
  }
  for (const [name, old] of oldDistricts) if (newDistricts.has(name)) compare(`area:${name}`, `${name}: pindala`, old.area, newDistricts.get(name).area, .95, 1.05);
  if (previous.shelterContext && !next.shelterContext) issues.push({ key: 'shelterContext', message: 'Varjumiskohtade allikavõrdlus kadus.' });
  if (previous.quality && !next.quality) issues.push({ key: 'quality', message: 'Lähteandmete kvaliteedimõõdikud kadusid.' });
  if (previous.quality && next.quality) {
    for (const key of ['population', 'shelters', 'districts', 'water', 'nationalShelters']) {
      compare(`source:${key}`, `Lähtekihi ${key} objektide arv`, previous.quality.sources[key], next.quality.sources[key], .8, 1.5);
    }
    compare('source:residents', 'Lähtekihi elanike summa', previous.quality.sources.residents, next.quality.sources.residents, .85, 1.25);
    const byName = new Map(next.quality.districts.map(d => [d.name, d]));
    for (const old of previous.quality.districts) {
      const row = byName.get(old.name); if (!row) continue;
      compare(`residents:${old.name}`, `${old.name}: elanikud`, old.residents, row.residents, .75, 1.5);
      compare(`coverage:${old.name}`, `${old.name}: avaldatud rahvastikualade pindala`, old.populationArea, row.populationArea, .75, 1.5);
    }
  }
  return issues;
}

export function validateUpdate(previous, next) {
  const issues = updateIssues(previous, next);
  if (issues.length) throw new DataQualityError(issues);
  return next;
}
