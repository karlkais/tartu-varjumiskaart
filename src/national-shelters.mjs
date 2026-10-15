import proj4 from 'proj4';

export const NATIONAL_SHELTERS_URL = 'https://opendata.smit.ee/gis/varjumiskohad.csv';
export const NATIONAL_SHELTERS_PAGE = 'https://www.rescue.ee/et/juhend/avaandmed/avalikud-varjumiskohad';
export const ESTONIA = '+proj=lcc +lat_1=59.3333333333333 +lat_2=58 +lat_0=57.5175539305556 +lon_0=24 +x_0=500000 +y_0=6375000 +ellps=GRS80 +units=m +no_defs';
const projection = proj4('EPSG:4326', ESTONIA);

// Semicolon CSV, including escaped quotes, BOM, CRLF and quoted newlines.
export function parseShelterCSV(text) {
  const rows = []; let row = [], field = '', quoted = false, closed = false;
  const input = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else field += c;
    } else if (c === ';' || c === '\n') {
      row.push(field); field = ''; closed = false;
      if (c === '\n') { if (row.some(v => v.trim())) rows.push(row); row = []; }
    } else if (c === '"' && !field && !closed) quoted = true;
    else if (closed || c === '"') throw new Error('Vigane Päästeameti CSV.');
    else field += c;
  }
  if (quoted) throw new Error('Päästeameti CSV katkes.');
  row.push(field); if (row.some(v => v.trim())) rows.push(row);
  const header = rows.shift();
  const required = ['id', 'nimi', 'aadress', 'tyyp', 'lest_x', 'lest_y'];
  if (!header || new Set(header).size !== header.length || required.some(key => !header.includes(key)) || !rows.length) throw new Error('Päästeameti CSV väljad puuduvad.');
  const ids = new Set();
  const features = rows.map(values => {
    if (values.length !== header.length) throw new Error('Päästeameti CSV rida on poolik.');
    const p = Object.fromEntries(header.map((key, i) => [key, values[i].trim()]));
    if (!p.id || ids.has(p.id) || !p.nimi || !p.aadress || p.tyyp !== 'Varjumiskoht' ||
        !/^\d+(?:\.\d+)?$/.test(p.lest_x) || !/^\d+(?:\.\d+)?$/.test(p.lest_y)) throw new Error('Vigane või korduv Päästeameti objekt.');
    ids.add(p.id);
    // The published x is NORTHING, y is EASTING (not GeoJSON axis order).
    const north = Number(p.lest_x), east = Number(p.lest_y);
    if (north < 6300000 || north > 6700000 || east < 300000 || east > 800000) throw new Error('Päästeameti koordinaadid ei sobi.');
    return { type: 'Feature', id: p.id, properties: p, geometry: { type: 'Point', coordinates: projection.inverse([east, north]) } };
  });
  return { type: 'FeatureCollection', features };
}

export async function fetchNationalShelters(fetcher = fetch) {
  const response = await fetcher(NATIONAL_SHELTERS_URL, { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(45_000) });
  if (!response.ok) throw new Error(`Päästeameti andmeteenuse vastus: ${response.status}.`);
  const csv = await response.text();
  const data = parseShelterCSV(csv);
  const modified = response.headers.get('last-modified');
  return { url: NATIONAL_SHELTERS_URL, pageUrl: NATIONAL_SHELTERS_PAGE, retrievedAt: new Date().toISOString(),
    modifiedAt: modified && Number.isFinite(Date.parse(modified)) ? new Date(modified).toISOString() : null, data, csv };
}
