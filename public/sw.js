const CACHE_NAME = 'stock-app-cache-v2';
const CORE_ASSETS = ['/', '/index.html', '/styles.css', '/js/app.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
});

// Cache-first for core assets; network-first with cache fallback for API and Yahoo
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isCore = CORE_ASSETS.includes(url.pathname);
  const isApi = url.protocol.startsWith('http') && (
    url.hostname.includes('localhost') ||
    url.hostname.includes('alphavantage') ||
    url.hostname.includes('yahoo')
  );

  if (isCore) {
    event.respondWith(
      caches.match(event.request).then((res) => res || fetch(event.request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
        return resp;
      }))
    );
    return;
  }

  if (isApi) {
    event.respondWith(
      fetch(event.request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
        return resp;
      }).catch(() => caches.match(event.request))
    );
    return;
  }
});


