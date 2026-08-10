/* PWA Service Worker — cache-first for static assets, network-first for dynamic.
 * Bump CACHE_NAME to invalidate old caches on deploy.
 */
const CACHE_NAME = 'store-v1';
const PRECACHE = [
  '/',
  '/products',
  '/css/main.css',
  '/css/admin.css',
  '/js/store.js',
  '/js/admin.js',
  '/manifest.webmanifest',
  '/uploads/icon-192.png',
  '/uploads/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never cache admin, cart, checkout, api, or uploads (uploads may change)
  if (
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/cart') ||
    url.pathname.startsWith('/checkout') ||
    url.pathname.startsWith('/uploads/')
  ) {
    return; // default network
  }

  // Cache-first for static assets, network-first for HTML
  const isAsset = /\.(css|js|png|jpg|jpeg|webp|gif|svg|ico|woff2?)$/i.test(url.pathname);

  if (isAsset) {
    e.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        });
      })
    );
  } else {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || caches.match('/')))
    );
  }
});
