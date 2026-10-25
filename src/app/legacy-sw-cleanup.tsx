'use client';
/** Retire only this game's old worker; preserve the new PWA and unrelated caches. */
export async function removeLegacyServiceWorkers():Promise<void> {
 if(!('serviceWorker' in navigator))return;
 const registrations=await navigator.serviceWorker.getRegistrations();
 await Promise.all(registrations.filter(registration=>{
  const worker=registration.active||registration.waiting||registration.installing;
  return worker&&new URL(worker.scriptURL).origin===window.location.origin&&new URL(worker.scriptURL).pathname==='/service-worker.js';
 }).map(registration=>registration.unregister()));
 if('caches' in window){const keys=await caches.keys();await Promise.all(keys.filter(key=>['juego-bolitas','canicas-try-again'].some(prefix=>key.startsWith(prefix))).map(key=>caches.delete(key)));}
}
