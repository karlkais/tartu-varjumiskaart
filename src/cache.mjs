import { newestSnapshot } from './snapshot.mjs';

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
  return {
    read: () => new Promise((resolve, reject) => {
      const request = db.transaction('snapshots').objectStore('snapshots').get('current');
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    }),
    save: snapshot => new Promise((resolve, reject) => {
      const transaction = db.transaction('snapshots', 'readwrite');
      const store = transaction.objectStore('snapshots');
      const request = store.get('current');
      // A slower tab must never overwrite a newer successful refresh.
      request.onsuccess = () => {
        if (newestSnapshot([snapshot, request.result]) === snapshot) store.put(snapshot, 'current');
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('Salvestamine katkes.'));
    }),
    close: () => db.close()
  };
}
