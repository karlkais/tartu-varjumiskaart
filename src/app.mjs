import L from 'leaflet';
import { openCache } from './cache.mjs';
import { newestSnapshot, isUpdateDue, refreshIfDue } from './snapshot.mjs';
import { newestBasemap, refreshBasemapIfDue } from './basemap-data.mjs';
import { createBasemapView } from './basemap-view.mjs';

const number = value => new Intl.NumberFormat('et-EE', { maximumFractionDigits: 0 }).format(value);
const date = value => new Intl.DateTimeFormat('et-EE', { dateStyle: 'medium' }).format(new Date(value));
const narrow = matchMedia('(max-width: 700px)');
const status = document.querySelector('#status');
const retry = document.querySelector('#retry');
const colors = { low: '#2ca25f', balanced: '#fdae61', high: '#d7191c', unknown: '#347ba4' };
const categories = { low: 'Madal (< 0,75)', balanced: 'Piiril (0,75–1,25)', high: 'Kõrge (> 1,25)' };
const map = L.map('map', { zoomControl: false, minZoom: 11, maxZoom: 19, zoomSnap: .25, zoomDelta: .5, maxBoundsViscosity: 1, preferCanvas: true }).setView([58.375, 26.73], 12);
L.control.zoom({ zoomInTitle: 'Suumi sisse', zoomOutTitle: 'Suumi välja' }).addTo(map);
map.attributionControl.addAttribution('Andmed: <a href="https://geohub.tartulv.ee/pages/avaandmed">Tartu linn</a>');
const basemapView = createBasemapView(map, message => {
  document.querySelector('#map-note').textContent = message;
});
map.createPane('population'); map.getPane('population').style.zIndex = 350;
map.createPane('water'); map.getPane('water').style.zIndex = 360;
map.createPane('districts'); map.getPane('districts').style.zIndex = 370;
map.createPane('shelters'); map.getPane('shelters').style.zIndex = 450;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function panel(title, position, html, open = !narrow.matches) {
  const control = L.control({ position });
  let content;
  control.onAdd = () => {
    const container = element('div', null, 'map-panel');
    const details = element('details'); details.open = open;
    details.append(element('summary', title));
    content = element('div'); content.innerHTML = html;
    details.append(content); container.append(details);
    narrow.addEventListener('change', () => { details.open = !narrow.matches; });
    L.DomEvent.disableClickPropagation(container); L.DomEvent.disableScrollPropagation(container);
    return container;
  };
  control.addTo(map);
  return content;
}

panel('Kaardi info', 'topleft', `<p>Markerile vajutades näed aadressi, mahutavust ja hinnangulist koormussuhet.</p><p>Iga rahvastikuruut määratakse sirgjooneliselt lähimale teadaoleva mahutavusega varjumiskohale. Koormussuhe on määratud elanike arvu ja mahutavuse suhe.</p><p>Elukohapõhine hinnang ei kajasta tegelikku täituvust ega arvesta tänavavõrku või päevast liikumist.</p><p>Hele aluskaart põhineb Maa- ja Ruumiameti ETAK andmetel. Tartu linnaosade piiridest väljapoole jääv ala on varjutatud.</p><p>Üle kuue kuu vanused varjumisandmed, arvutused ja aluskaart uuenevad kaardi avamisel. Mõlemal andmestikul on oma eduka uuenduse kuupäev. Tõrke korral jääb senine versioon alles. Salvestus on selle brauseri põhine.</p><p>Kuupäevad tähistavad edukat laadimist ja arvutamist, mitte kõigi lähteobjektide viimast muutmisaega.</p><p><a href="https://geohub.tartulv.ee/pages/avaandmed" target="_blank" rel="noopener">Tartu avaandmed</a> · <a href="https://geoportaal.maaruum.ee/" target="_blank" rel="noopener">Maa- ja Ruumiamet</a> · <a href="https://github.com/karlkais/tartu-varjumiskaart" target="_blank" rel="noopener">Projekt GitHubis</a></p>`, false);
const legend = panel('Kaardi legend', 'bottomleft', `<h2>Koormussurve</h2>${Object.entries(categories).map(([key, label]) => `<div class="legend-row"><span class="swatch" style="background:${colors[key]}"></span>${label}</div>`).join('')}<div class="legend-row unknown-key">● Mahutavus teadmata</div><h2>Varjumiskoha mahutavus</h2><div class="size-row">${[250, 1000, 5000, 13000].map(value => `<div class="size-key"><svg width="40" height="40" aria-hidden="true"><circle cx="20" cy="20" r="${Math.sqrt(value) / 8 + 4}" fill="#8c9d9155" stroke="#5b6f63"/></svg>${number(value)}</div>`).join('')}</div><h2>Elanikke 100 m ruudus</h2><div class="gradient"></div><div class="gradient-labels"><span>0</span><span id="population-max"></span></div>`);

function popup(properties) {
  const container = element('div');
  container.append(element('strong', properties.name), element('div', properties.address, 'popup-address'));
  function row(label, value) {
    const line = element('div', null, 'popup-row');
    line.append(element('span', label), element('b', value)); container.append(line);
  }
  if (!(properties.capacity > 0)) row('Mahutavus', 'Teadmata');
  else {
    row('Mahutavus', number(properties.capacity));
    row('Määratud elanikke', number(properties.assigned));
    row('Koormussuhe', `${new Intl.NumberFormat('et-EE', { maximumFractionDigits: 2 }).format(properties.ratio)} ×`);
    row('Koormusklass', categories[properties.category]);
    container.append(element('div', 'Lähima varjumiskoha mudeli hinnang, mitte tegelik täituvus.', 'popup-note'));
  }
  return container;
}

let mapLayers, layerControl, current, currentBasemap, cache, busy = false;
function render(snapshot) {
  const visibility = mapLayers ? Object.fromEntries(Object.entries(mapLayers).map(([key, layer]) => [key, map.hasLayer(layer)])) : { districts: true, water: true, population: false, shelters: true, unknown: true };
  const populationMax = Math.max(...snapshot.layers.population.features.map(f => f.properties.residents));
  const palette = ['#ffffe5', '#fff7bc', '#fee391', '#fec44f', '#fe9929', '#ec7014', '#cc4c02', '#993404', '#662506'];
  const onEach = (feature, layer) => layer.bindPopup(element('div', feature.properties.name ?? 'Veekogu'));
  const nextLayers = {
    districts: L.geoJSON(snapshot.layers.districts, { pane: 'districts', style: { fill: false, color: '#798781', weight: .8, opacity: .6 }, onEachFeature: (f, l) => { onEach(f, l); l.bindTooltip(element('span', f.properties.name)); } }),
    water: L.geoJSON(snapshot.layers.water, { pane: 'water', style: { color: '#a7c9d6', weight: .5, fillColor: '#c7dce4', fillOpacity: 1 }, onEachFeature: onEach }),
    population: L.geoJSON(snapshot.layers.population, { pane: 'population', style: f => ({ weight: 0, fillOpacity: .55, fillColor: palette[Math.min(8, Math.floor(f.properties.residents / populationMax * 8))] }), onEachFeature: (f, l) => l.bindPopup(element('div', `Elanikke ruudus: ${number(f.properties.residents)}`)) }),
    shelters: L.geoJSON(snapshot.layers.shelters, { filter: f => f.properties.capacity > 0, pointToLayer: (f, ll) => L.circleMarker(ll, { pane: 'shelters', radius: Math.sqrt(f.properties.capacity) / 8 + 4, color: colors[f.properties.category], fillOpacity: .9, weight: 1 }), onEachFeature: (f, l) => { l.bindPopup(popup(f.properties)); l.bindTooltip(element('span', f.properties.name)); } }),
    unknown: L.geoJSON(snapshot.layers.shelters, { filter: f => !(f.properties.capacity > 0), pointToLayer: (f, ll) => L.marker(ll, { pane: 'shelters', title: f.properties.name, icon: L.icon({ iconUrl: './app/images/marker-icon.png', iconRetinaUrl: './app/images/marker-icon-2x.png', shadowUrl: './app/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] }) }), onEachFeature: (f, l) => { l.bindPopup(popup(f.properties)); l.bindTooltip(element('span', f.properties.name)); } })
  };
  if (layerControl) layerControl.remove();
  if (mapLayers) Object.values(mapLayers).forEach(layer => map.removeLayer(layer));
  for (const [key, layer] of Object.entries(nextLayers)) if (visibility[key]) layer.addTo(map);
  layerControl = L.control.layers(null, { 'Rahvastik 100 m ruudus': nextLayers.population, 'Varjumiskohad': nextLayers.shelters, 'Mahutavuseta varjumiskohad': nextLayers.unknown }, { collapsed: narrow.matches }).addTo(map);
  const toggle = layerControl.getContainer().querySelector('.leaflet-control-layers-toggle');
  toggle.title = 'Kaardi kihid'; toggle.setAttribute('aria-label', 'Kaardi kihid');
  legend.querySelector('#population-max').textContent = number(populationMax);
  if (!mapLayers) map.fitBounds(nextLayers.districts.getBounds(), { padding: [25, 25] });
  mapLayers = nextLayers;
  current = snapshot;
  runWorker({ type: 'boundary', districts: snapshot.layers.districts }, { progress: false }).then(boundary => {
    if (current === snapshot) basemapView.setBoundary(boundary);
  }).catch(() => { document.querySelector('#map-note').textContent = 'Linnapiiri varjutust ei saanud arvutada.'; });
  document.querySelector('#data-date').textContent = `Andmed ja arvutused: ${date(snapshot.updatedAt)} · Rahvastik: ${snapshot.populationYear}`;
  document.querySelector('#data-date').title = `Viimane edukas uuendus: ${new Date(snapshot.updatedAt).toLocaleString('et-EE')}`;
}

function setStatus(text, state = 'fresh') { status.textContent = text; status.dataset.state = state; }

function runWorker(message, { progress = true } = {}) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.js?v=2.1.0', import.meta.url), { type: 'module' });
    const timer = setTimeout(() => finish(new Error('Uuendamine võttis liiga kaua aega.')), message.type === 'refresh-basemap' ? 300_000 : 180_000);
    function finish(error, result) {
      clearTimeout(timer); worker.terminate();
      if (error) reject(error); else resolve(result);
    }
    worker.onmessage = ({ data }) => {
      if (data.stage) { if (progress) setStatus(`${data.stage} Senine kaart on kasutatav.`, 'loading'); }
      else if (data.error) finish(new Error(data.error));
      else finish(null, data.result);
    };
    worker.onerror = () => finish(new Error('Arvutust ei saanud käivitada.'));
    worker.postMessage(message);
  });
}

async function renderBasemap(snapshot) {
  currentBasemap = snapshot;
  document.querySelector('#basemap-date').textContent = snapshot ? `Aluskaart laaditud: ${date(snapshot.updatedAt)}` : 'Aluskaart pole veel kättesaadav';
  await basemapView.show(snapshot);
}

async function update() {
  if (busy) return;
  busy = true; retry.hidden = true;
  try {
    async function lockedUpdate() {
      // Another tab may already have completed an update while this tab waited.
      let saved, savedBasemap;
      try { saved = await cache?.read(); } catch { /* The displayed snapshot remains usable. */ }
      try { savedBasemap = await cache?.readBasemap(); } catch { /* Keep the visible basemap. */ }
      const latest = newestSnapshot([current, saved]);
      if (latest !== current) render(latest);
      const latestBasemap = newestBasemap([currentBasemap, savedBasemap]);
      if (latestBasemap !== currentBasemap) await renderBasemap(latestBasemap);
      const result = await refreshIfDue(current, {
        fetchData: () => runWorker({ type: 'refresh' }), calculate: value => value,
        save: value => cache ? cache.save(value) : Promise.reject(new Error('Salvestus pole lubatud.'))
      });
      if (result.snapshot !== current) render(result.snapshot);
      if (!currentBasemap || isUpdateDue(currentBasemap)) setStatus('Laadin aluskaardi värskeid andmeid… Senine kaart on kasutatav.', 'loading');
      // Basemap failures never undo or prevent a successful shelter-data update.
      const baseResult = await refreshBasemapIfDue(currentBasemap, {
        fetchData: () => runWorker({ type: 'refresh-basemap', districts: current.layers.districts }),
        save: value => cache ? cache.saveBasemap(value) : Promise.reject(new Error('Salvestus pole lubatud.'))
      });
      if (baseResult.snapshot !== currentBasemap) await renderBasemap(baseResult.snapshot);
      const failed = [[result, 'Varjumisandmete'], [baseResult, 'Aluskaardi']].filter(([r]) => r.state === 'failed');
      status.title = '';
      if (failed.length) {
        setStatus(`${failed.map(([, name]) => name).join(' ja ')} uuendus ebaõnnestus. Senine versioon säilis.`, 'failed');
        status.title = failed.map(([r]) => r.error.message).join('\n'); retry.hidden = false;
      } else if ([result, baseResult].some(r => r.state === 'unsaved')) {
        setStatus('Uuendus valmis. Brauser ei lubanud kõiki andmeid järgmiseks korraks salvestada.', 'unsaved');
      } else if ([result, baseResult].some(r => r.state === 'updated')) {
        setStatus('Andmed, arvutused ja aluskaart on ajakohased.');
      } else setStatus('Andmed ja aluskaart uuenevad avamisel, kui viimasest uuendusest on üle kuue kuu.');
    }
    if (navigator.locks?.request) {
      if (isUpdateDue(current) || !currentBasemap || isUpdateDue(currentBasemap)) setStatus('Kontrollin andmete ja aluskaardi uuendamist…', 'loading');
      await navigator.locks.request('tartu-varjumiskaart-refresh', lockedUpdate);
    } else await lockedUpdate();
  } catch (error) {
    setStatus('Uuendamine ebaõnnestus. Kuvatud on viimased toimivad andmed.', 'failed');
    status.title = error.message; retry.hidden = false;
  } finally { busy = false; }
}

retry.addEventListener('click', update);

async function start() {
  const cacheReady = openCache().then(store => { cache = store; return store; });
  const cachedBasemap = cacheReady.then(store => store.readBasemap());
  const basemapReady = Promise.allSettled([
    fetch('./basemap.json.gz', { cache: 'no-cache', signal: AbortSignal.timeout(60_000) }).then(response => {
      if (!response.ok) throw new Error('Aluskaardi algandmed pole kättesaadavad.');
      return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
    }),
    cachedBasemap
  ]);
  const cachedData = cacheReady.then(store => store.read());
  const dataReady = Promise.allSettled([
    fetch('./snapshot.json', { cache: 'no-cache', signal: AbortSignal.timeout(20_000) }).then(response => { if (!response.ok) throw new Error('Kaardi algandmed pole kättesaadavad.'); return response.json(); }),
    cachedData
  ]);
  // Show a valid local version without waiting for a slow or unavailable host.
  try {
    const saved = newestSnapshot([await cachedData]);
    if (saved) render(saved);
    const savedBase = newestBasemap([await cachedBasemap]);
    if (savedBase && current) await renderBasemap(savedBase);
  } catch { /* The shipped baseline remains available without IndexedDB. */ }
  const results = await dataReady;
  const snapshot = newestSnapshot([current, ...results.filter(result => result.status === 'fulfilled').map(result => result.value)]);
  if (!snapshot) throw new Error('Kaardi andmeid ei saanud laadida. Kontrolli internetiühendust ja laadi leht uuesti.');
  if (snapshot !== current) render(snapshot);
  const baseResults = await basemapReady;
  const basemap = newestBasemap([currentBasemap, ...baseResults.filter(result => result.status === 'fulfilled').map(result => result.value)]);
  await renderBasemap(basemap);
  performance.mark('tartu-map-ready');
  // Save the shipped baseline with its original timestamp, never the opening time.
  try { if (cache) await cache.save(snapshot); } catch { /* An update can still run without persistent storage. */ }
  try { if (cache && basemap) await cache.saveBasemap(basemap); } catch { /* Keep session data if storage is full. */ }
  await update();
}

start().catch(error => { const alert = document.querySelector('#fatal'); alert.hidden = false; alert.textContent = error.message; setStatus('Kaardi laadimine ebaõnnestus.', 'failed'); });
