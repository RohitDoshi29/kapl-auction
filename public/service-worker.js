// KAPL 3.0 Service Worker - Auto-cleanup & Pass-through
// Decommissions legacy caches to prevent stale chunk lock-in on live auction stage

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
        console.log('[SW] Legacy caches purged');
      } catch (err) {
        console.error('[SW] Cache purge error:', err);
      }
      try {
        await self.registration.unregister();
        console.log('[SW] Service worker unregistered successfully');
      } catch (err) {
        console.error('[SW] Unregister error:', err);
      }
      await self.clients.claim();
    })()
  );
});

// Pass through all requests directly to the network without caching
self.addEventListener('fetch', (event) => {
  // Direct network pass-through to ensure fresh chunk hashes and real-time live data
  return;
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

