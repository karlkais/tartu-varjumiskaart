import proj4 from 'proj4';
import GeoJSONReader from 'jsts/org/locationtech/jts/io/GeoJSONReader.js';
import GeoJSONWriter from 'jsts/org/locationtech/jts/io/GeoJSONWriter.js';
import 'jsts/org/locationtech/jts/monkey.js';
import { SCHEMA_VERSION, MODEL_VERSION } from './snapshot.mjs';
import { POPULATION_CONTEXT_VERSION, validatePopulationContext } from './population-context.mjs';
import { reconcileShelters, shelterContext } from './shelter-reconciliation.mjs';
import { validateRawLayers } from './geometry-validation.mjs';
import { QUALITY_VERSION } from './data-quality.mjs';

const ESTONIA = '+proj=lcc +lat_1=59.3333333333333 +lat_2=58 +lat_0=57.5175539305556 +lon_0=24 +x_0=500000 +y_0=6375000 +ellps=GRS80 +units=m +no_defs';
const projection = proj4('EPSG:4326', ESTONIA);
const reader = new GeoJSONReader();
const writer = new GeoJSONWriter();
const collection = features => ({ type: 'FeatureCollection', features });

function transform(geometry, project) {
  if (geometry.type === 'GeometryCollection') return { ...geometry, geometries: geometry.geometries.map(g => transform(g, project)) };
  const visit = coords => typeof coords[0] === 'number' ? project(coords.slice(0, 2)) : coords.map(visit);
  return { type: geometry.type, coordinates: visit(geometry.coordinates) };
}

function planar(feature) {
  let geometry = reader.read(transform(feature.geometry, coords => projection.forward(coords)));
  if (!geometry.isValid()) geometry = geometry.buffer(0);
  if (geometry.isEmpty() || !geometry.isValid()) throw new Error('Andmeallika geomeetriat ei saa parandada.');
  return geometry;
}

function feature(geometry, properties) {
  return { type: 'Feature', properties, geometry: transform(writer.write(geometry), coords => projection.inverse(coords)) };
}

export function calculateModel(raw) {
  validateRawLayers(raw);
  const districts = raw.layers.districts.features.map(f => ({ source: f, geometry: planar(f), residents: 0, populationArea: 0 }));
  const mask = reader.read({ type: 'GeometryCollection', geometries: districts.map(f => writer.write(f.geometry)) }).union();
  const cityShelters = raw.layers.shelters.features.filter(f => planar(f).within(mask));
  const nationalShelters = raw.shelterSources?.national.data.features.filter(f => planar(f).within(mask));
  const reconciled = nationalShelters ? reconcileShelters(cityShelters, nationalShelters) : cityShelters.filter(f => f.properties.Toimiv === 1);
  const shelters = reconciled
    .map(f => ({ source: f, geometry: planar(f) }))
    .filter(f => f.geometry.within(mask))
    .map(f => ({ ...f, assigned: 0 }));
  const known = shelters.filter(f => f.source.properties.Mahutavus > 0);
  if (!known.length) throw new Error('Mahutavusega varjumiskohti ei leitud.');
  const population = [];
  const populationAreas = [];
  const zeroPopulation = [];
  for (const source of raw.layers.population.features) {
    const geometry = planar(source);
    const area = geometry.getArea();
    if (!(area > 0)) throw new Error('Rahvastikuala pindala puudub.');
    populationAreas.push({ geometry, area, residents: source.properties.sum_sum_kokku });
    if (!geometry.getEnvelopeInternal().intersects(mask.getEnvelopeInternal())) continue;
    const clipped = geometry.intersection(mask);
    if (clipped.isEmpty() || clipped.getArea() <= 0) continue;
    for (const district of districts) {
      if (!clipped.getEnvelopeInternal().intersects(district.geometry.getEnvelopeInternal())) continue;
      const covered = clipped.intersection(district.geometry).getArea();
      district.populationArea += covered;
      district.residents += source.properties.sum_sum_kokku * covered / area;
    }
    if (source.properties.sum_sum_kokku === 0) {
      zeroPopulation.push(feature(clipped, { id: source.id, residents: 0 }));
      continue;
    }
    const residents = source.properties.sum_sum_kokku * clipped.getArea() / area;
    const point = clipped.getInteriorPoint().getCoordinate();
    let nearest = null, minimum = Infinity;
    for (const shelter of known) {
      const location = shelter.geometry.getCoordinate();
      const distance = (point.x - location.x) ** 2 + (point.y - location.y) ** 2;
      if (distance < minimum) { minimum = distance; nearest = shelter; }
    }
    nearest.assigned += residents;
    population.push(feature(clipped, { id: source.id, residents, shelterId: nearest.source.id }));
  }
  const water = raw.layers.water.features.flatMap(source => {
    const clipped = planar(source).intersection(mask);
    return clipped.isEmpty() || clipped.getArea() <= 0 ? [] : [feature(clipped, { id: source.id, name: source.properties.Nimi ?? 'Veekogu' })];
  });
  return {
    schemaVersion: SCHEMA_VERSION, modelVersion: MODEL_VERSION,
    populationYear: raw.populationYear, sources: raw.sources,
    populationContext: populationContext(raw, populationAreas, mask, population),
    shelterContext: shelterContext(raw.shelterSources, reconciled),
    quality: { version: QUALITY_VERSION,
      sources: { ...Object.fromEntries(['population', 'shelters', 'districts', 'water'].map(k => [k, raw.layers[k].features.length])),
        nationalShelters: nationalShelters?.length ?? 0,
        residents: raw.layers.population.features.reduce((n, f) => n + f.properties.sum_sum_kokku, 0) },
      districts: districts.map(d => ({ name: d.source.properties.NIMI, area: d.geometry.getArea(), residents: d.residents, populationArea: d.populationArea })) },
    layers: {
      districts: collection(districts.map(f => feature(f.geometry, { id: f.source.id, name: f.source.properties.NIMI }))),
      water: collection(water), population: collection(population), zeroPopulation: collection(zeroPopulation),
      shelters: collection(shelters.map(f => {
        const p = f.source.properties;
        const ratio = p.Mahutavus > 0 ? f.assigned / p.Mahutavus : null;
        return feature(f.geometry, {
          id: f.source.id, name: p.Nimetus, address: p.Aadress ?? '', capacity: p.Mahutavus,
          ...(p.sourceAudit ? { sourceAudit: p.sourceAudit } : {}),
          assigned: ratio === null ? null : f.assigned, ratio,
          category: ratio === null ? 'unknown' : ratio < 0.75 ? 'low' : ratio <= 1.25 ? 'balanced' : 'high'
        });
      }))
    }
  };
}

function populationContext(raw, areas, mask, population) {
  const input = raw.populationContext;
  const total = population.reduce((sum, f) => sum + f.properties.residents, 0);
  const context = { version: POPULATION_CONTEXT_VERSION, year: raw.populationYear,
    source: input?.source ?? null, comparison: null,
    unavailableReason: input?.unavailableReason ?? 'Selles salvestises puuduvad sama aasta linnaosade võrdlusandmed.' };
  if (!input?.comparison) return context;
  try {
    const districts = input.comparison.data.features.map(f => {
      const geometry = planar(f);
      // Compare the same urban region; never sum a different administrative extent.
      if (geometry.intersection(mask).getArea() / geometry.getArea() < .95) throw new Error('Võrdluspiirkond ei sobi.');
      let published = 0;
      for (const cell of areas) {
        if (cell.residents === 0 || !cell.geometry.getEnvelopeInternal().intersects(geometry.getEnvelopeInternal())) continue;
        published += cell.residents * cell.geometry.intersection(geometry).getArea() / cell.area;
      }
      return { id: f.id, name: f.properties.nimi, official: f.properties.sum_sum_kokku, published };
    });
    const referenceMask = reader.read({ type: 'GeometryCollection', geometries: input.comparison.data.features.map(f => writer.write(planar(f))) }).union();
    if (mask.intersection(referenceMask).getArea() / mask.getArea() < .95) throw new Error('Võrdluspiirkond on poolik.');
    const result = { ...context, unavailableReason: null, comparison: { source: input.comparison.source,
      officialTotal: districts.reduce((sum, row) => sum + row.official, 0), modeledTotal: total, districts } };
    validatePopulationContext(result, raw.populationYear, total);
    return result;
  } catch {
    return { ...context, unavailableReason: 'Linnaosade võrdlusandmete aastat, piirkonda või summasid ei saanud kinnitada.' };
  }
}

export function cityOutline(districts) {
  const geometries = districts.features.map(f => writer.write(planar(f)));
  const union = reader.read({ type: 'GeometryCollection', geometries }).union();
  return feature(union, { name: 'Tartu linnapiir' });
}
