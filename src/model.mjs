import proj4 from 'proj4';
import GeoJSONReader from 'jsts/org/locationtech/jts/io/GeoJSONReader.js';
import GeoJSONWriter from 'jsts/org/locationtech/jts/io/GeoJSONWriter.js';
import 'jsts/org/locationtech/jts/monkey.js';
import { SCHEMA_VERSION, MODEL_VERSION } from './snapshot.mjs';

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
  const districts = raw.layers.districts.features.map(f => ({ source: f, geometry: planar(f) }));
  const mask = reader.read({ type: 'GeometryCollection', geometries: districts.map(f => writer.write(f.geometry)) }).union();
  const shelters = raw.layers.shelters.features.filter(f => f.properties.Toimiv === 1)
    .map(f => ({ source: f, geometry: planar(f) }))
    .filter(f => f.geometry.within(mask))
    .map(f => ({ ...f, assigned: 0 }));
  const known = shelters.filter(f => f.source.properties.Mahutavus > 0);
  if (!known.length) throw new Error('Mahutavusega varjumiskohti ei leitud.');
  const population = [];
  for (const source of raw.layers.population.features) {
    if (source.properties.sum_sum_kokku === 0) continue;
    const geometry = planar(source);
    if (!geometry.getEnvelopeInternal().intersects(mask.getEnvelopeInternal())) continue;
    const clipped = geometry.intersection(mask);
    const area = geometry.getArea();
    if (clipped.isEmpty() || clipped.getArea() <= 0) continue;
    if (!(area > 0)) throw new Error('Rahvastikuruudu pindala puudub.');
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
    return clipped.isEmpty() || clipped.getArea() <= 0 ? [] : [feature(clipped, { name: source.properties.Nimi ?? 'Veekogu' })];
  });
  return {
    schemaVersion: SCHEMA_VERSION, modelVersion: MODEL_VERSION,
    populationYear: raw.populationYear, sources: raw.sources,
    layers: {
      districts: collection(districts.map(f => feature(f.geometry, { name: f.source.properties.NIMI }))),
      water: collection(water), population: collection(population),
      shelters: collection(shelters.map(f => {
        const p = f.source.properties;
        const ratio = p.Mahutavus > 0 ? f.assigned / p.Mahutavus : null;
        return feature(f.geometry, {
          id: f.source.id, name: p.Nimetus, address: p.Aadress ?? '', capacity: p.Mahutavus,
          assigned: ratio === null ? null : f.assigned, ratio,
          category: ratio === null ? 'unknown' : ratio < 0.75 ? 'low' : ratio <= 1.25 ? 'balanced' : 'high'
        });
      }))
    }
  };
}
