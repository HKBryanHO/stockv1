const CACHE_NAME = 'stock-app-cache-v13';
const CORE_ASSETS = ['/', '/index.html', '/login.html', '/styles.css', '/js/app.js', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Clear old caches
      return caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      }).then(() => {
        return cache.addAll(CORE_ASSETS);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      // Clear ALL old caches
      return Promise.all(keys.map(k => caches.delete(k)));
    }).then(() => {
      // Force reload all clients
      return self.clients.claim();
    })
  );
});

// Cache-first for core assets; network-first for same-origin API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isCore = CORE_ASSETS.includes(url.pathname);
  const isSameOrigin = url.origin === self.location.origin;

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

  // Network-first for API; cache fallback (includes same-origin and reverse-proxied /api on same origin)
  if (isSameOrigin && url.pathname.startsWith('/api/')) {
    // Only cache GET requests, not POST
    if (event.request.method === 'GET') {
      event.respondWith(
        fetch(event.request).then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
          return resp;
        }).catch(() => caches.match(event.request))
      );
    } else {
      // For POST requests, just fetch without caching
      event.respondWith(fetch(event.request));
    }
    return;
  }

  // Static assets: cache-first for JS/CSS/images
  if (isSameOrigin && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i))) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
        return resp;
      }))
    );
    return;
  }
});


