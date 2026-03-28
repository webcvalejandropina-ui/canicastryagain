// Transitional SW to remove legacy caches and disable offline interception.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));

      await self.clients.claim();

      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.all(
        windows.map((client) => {
          if ('navigate' in client) {
            return client.navigate(client.url);
          }

          return Promise.resolve(undefined);
        })
      );

      await self.registration.unregister();
    })()
  );
});
