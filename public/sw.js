const CACHE_NAME = 'splitsmart-v14';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './app-image.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle navigations/static GETs. Never intercept API calls or non-GET
  // requests (e.g. the POST to /api/analyze-receipt): caches.match on those
  // resolves undefined, which would turn a transient network error into a hard
  // failure. Let the browser handle them directly.
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) return;

  // Simple network-first approach to satisfy installability without complex
  // offline logic. Fall back to cache only when the network fetch fails AND we
  // actually have a cached copy.
  event.respondWith(
    fetch(event.request).catch(async () =>
      (await caches.match(event.request)) || Response.error()
    )
  );
});