import L from 'leaflet';
import { maplibreGL } from '@maplibre/maplibre-gl-leaflet';
import { setWorkerUrl, setWorkerCount } from 'maplibre-gl';
import { basemapStyle } from './basemap-style.mjs';

setWorkerUrl(new URL('./maplibre-worker.js', import.meta.url).href);
setWorkerCount(1);

export function createBasemapView(map, onWarning) {
  let layer, fallback, displayed, generation = 0, mask, outline;
  map.createPane('city-mask'); map.getPane('city-mask').style.zIndex = 330;
  map.getPane('city-mask').style.pointerEvents = 'none';
  const attribution = date => `Alusandmed: <a href="https://geoportaal.maaruum.ee/">Maa- ja Ruumiamet, ETAK</a> (${date})`;
  let previousAttribution;
  function canvasFallback(snapshot) {
    if (layer) { try { map.removeLayer(layer); } catch { /* GL setup may have failed. */ } layer = null; }
    if (fallback) map.removeLayer(fallback);
    const renderer = L.canvas({ padding: .3, pane: 'tilePane' });
    fallback = L.layerGroup();
    const styles = { woodland: { fillColor: '#e4e9df' }, lakes: { fillColor: '#c7dce4' }, rivers: { fillColor: '#c7dce4' }, buildings: { fillColor: '#deddd9' }, roads: { color: '#fff', weight: 2 }, railways: { color: '#b7b8b4', weight: 1, dashArray: '3 3' } };
    for (const [key, data] of Object.entries(snapshot.layers)) L.geoJSON(data, { renderer, pane: 'tilePane', interactive: false, style: { stroke: false, fillOpacity: 1, ...styles[key], ...(['roads', 'railways'].includes(key) ? { stroke: true } : {}) } }).addTo(fallback);
    fallback.addTo(map);
    onWarning('Brauser kasutab lihtsustatud aluskaarti; tänavanimesid ei kuvata.');
  }
  async function show(snapshot) {
    if (!snapshot || displayed === snapshot) return;
    const attempt = ++generation;
    if (previousAttribution) map.attributionControl.removeAttribution(previousAttribution);
    previousAttribution = attribution(new Date(snapshot.updatedAt).toLocaleDateString('et-EE'));
    map.attributionControl.addAttribution(previousAttribution);
    const [west, south, east, north] = snapshot.bounds;
    map.setMaxBounds([[south, west], [north, east]]);
    try {
      if (layer) {
        const gl = layer.getMaplibreMap();
        for (const [key, data] of Object.entries(snapshot.layers)) gl.getSource(key).setData(data);
      } else if (fallback) canvasFallback(snapshot);
      else {
        layer = maplibreGL({ style: basemapStyle(snapshot), attributionControl: false, interactive: false, renderWorldCopies: false });
        layer.addTo(map);
        await new Promise((resolve, reject) => {
          const gl = layer.getMaplibreMap();
          const timeout = setTimeout(() => reject(new Error('Aluskaardi kuvamine aegus.')), 30_000);
          gl.once('load', () => { clearTimeout(timeout); resolve(); });
          gl.once('error', event => { clearTimeout(timeout); reject(event.error); });
          gl.getCanvas().addEventListener('webglcontextlost', () => {
            if (displayed) canvasFallback(displayed);
          }, { once: true });
        });
      }
    } catch { if (attempt === generation) canvasFallback(snapshot); }
    if (attempt === generation) displayed = snapshot;
  }
  function setBoundary(feature) {
    if (mask) map.removeLayer(mask);
    if (outline) map.removeLayer(outline);
    const geometry = feature.geometry;
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    const rings = polygons.flat().map(ring => ring.map(([x, y]) => [y, x]));
    mask = L.polygon([[[-85, -180], [-85, 180], [85, 180], [85, -180]], ...rings], {
      pane: 'city-mask', interactive: false, stroke: false, fillColor: '#27343f', fillOpacity: .3, fillRule: 'evenodd'
    }).addTo(map);
    outline = L.geoJSON(feature, { pane: 'city-mask', interactive: false, style: { fill: false, color: '#65746d', opacity: .6, weight: 1.3 } }).addTo(map);
  }
  return { show, setBoundary };
}
