import { fetchAllData } from './sources.mjs';
import { calculateModel, cityOutline } from './model.mjs';
import { fetchBasemap } from './basemap-data.mjs';

self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'boundary') {
      self.postMessage({ result: cityOutline(data.districts) });
      return;
    }
    if (data.type === 'refresh-basemap') {
      const names = { woodland: 'haljastust', lakes: 'järvi ja tiike', rivers: 'jõgesid', buildings: 'hooneid', roads: 'teid ja tänavanimesid', railways: 'raudteid' };
      const result = await fetchBasemap(data.districts, { progress: (kind, count) => self.postMessage({ stage: `Uuendan aluskaarti: ${names[kind]} (${count})…` }) });
      self.postMessage({ result });
      return;
    }
    self.postMessage({ stage: 'Laadin värskeid avaandmeid…' });
    const raw = await fetchAllData();
    self.postMessage({ stage: 'Arvutan varjumiskohtade koormussuhted…' });
    const result = calculateModel(raw);
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: error.message || 'Andmete uuendamine ebaõnnestus.' });
  }
};
