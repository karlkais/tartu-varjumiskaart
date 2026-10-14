import { fetchAllData } from './sources.mjs';
import { calculateModel } from './model.mjs';

self.onmessage = async () => {
  try {
    self.postMessage({ stage: 'Laadin värskeid avaandmeid…' });
    const raw = await fetchAllData();
    self.postMessage({ stage: 'Arvutan varjumiskohtade koormussuhted…' });
    const result = calculateModel(raw);
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: error.message || 'Andmete uuendamine ebaõnnestus.' });
  }
};
