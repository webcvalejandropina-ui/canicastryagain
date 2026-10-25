/* Compatibility retirement for old installs. The new application registers /sw.js. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const names=await caches.keys();
 await Promise.all(names.filter(name=>['juego-bolitas','canicas-try-again'].some(prefix=>name.startsWith(prefix))).map(name=>caches.delete(name)));
 await self.registration.unregister();
})()));
