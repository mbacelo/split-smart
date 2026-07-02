// Runtime-cached, network-first service worker.
//
// Every successful same-origin GET response is copied into a runtime cache as
// it's fetched, so the app shell AND the hashed JS/CSS bundles it references
// are cached together — an offline launch replays the last working version
// (the old precache-list approach cached index.html but not the hashed bundles
// it pointed at, so offline loads produced a broken shell). Network wins
// whenever it's available, so deploys are picked up immediately and no manual
// cache-version bump is needed: hashed asset URLs are immutable, and stale
// entries just sit unused. The cache grows a little with each deploy; browsers
// evict under storage pressure, which is acceptable at this app's size.
const RUNTIME_CACHE = 'splitsmart-runtime-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
  // Drop caches from older SW versions (including the old precache scheme).
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== RUNTIME_CACHE).map((n) => caches.delete(n)))
    )
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle same-origin GETs. Never intercept API calls, non-GET requests
  // (e.g. the POST to /api/analyze-receipt), or cross-origin requests (the GIS
  // script, Google fonts/photos) — let the browser handle those directly.
  const url = new URL(event.request.url);
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/')
  ) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, copy))
          );
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // Offline navigation with no exact match: fall back to the cached shell.
        if (event.request.mode === 'navigate') {
          const shell = (await caches.match('./')) || (await caches.match('./index.html'));
          if (shell) return shell;
        }
        return Response.error();
      })
  );
});
