// Service Worker: red primero, caché como respaldo sin conexión.
const CACHE_NAME = 'fnf-mobile-v7.1.0';

const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/boot.js',
  ...['utils', 'render', 'ui-theme', 'firebase-config', 'extras', 'auth', 'profile', 'live', 'social',
      'downloads', 'favorites', 'requests', 'support', 'notifications', 'admin'].map(f => `./js/modules/${f}.js`),
  './js/modules/data-apks.js',
  './js/modules/data-mods.js',
  './js/modules/data-scripts.js',
  './assets/icons/logo192.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // Se guardan uno por uno: si falta alguno, los demás sí quedan en caché
      .then(cache => Promise.allSettled(urlsToCache.map(u => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
