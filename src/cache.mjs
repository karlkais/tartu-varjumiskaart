import { newestSnapshot } from './snapshot.mjs';
import { newestBasemap } from './basemap-data.mjs';

const DATABASE = 'tartu-varjumiskaart';

export async function openCache(indexedDB = globalThis.indexedDB) {
  if (!indexedDB) throw new Error('Brauseri andmesalvestus pole kättesaadav.');
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('snapshots');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Andmesalvestus on teises aknas blokeeritud.'));
  });
  db.onversionchange = () => db.close();
  function record(key, newest) { return {
    read: () => new Promise((resolve, reject) => {
      const request = db.transaction('snapshots').objectStore('snapshots').get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    }),
    save: snapshot => new Promise((resolve, reject) => {
      if (newest([snapshot]) !== snapshot) { reject(new Error('Vigast andmeversiooni ei salvestata.')); return; }
      const transaction = db.transaction('snapshots', 'readwrite');
      const store = transaction.objectStore('snapshots');
      const request = store.get(key);
      // A slower tab must never overwrite a newer successful refresh.
      request.onsuccess = () => {
        if (newest([snapshot, request.result]) === snapshot) store.put(snapshot, key);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('Salvestamine katkes.'));
    })
  }; }
  const data = record('current', newestSnapshot);
  const basemap = record('basemap', newestBasemap);
  return { ...data, readBasemap: basemap.read, saveBasemap: basemap.save, close: () => db.close() };
}
