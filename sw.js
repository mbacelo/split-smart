const CACHE_NAME = 'splitsmart-v12';
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
  // Simple network-first approach to satisfy installability without complex offline logic
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});