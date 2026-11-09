// Service Worker de FNF' Ports
// · Imágenes, iconos y fuentes: al instante desde la caché y se actualizan por detrás.
// · HTML, JS y CSS: primero internet (para no quedarse con versiones viejas), pero si tarda
//   más de 3 segundos o no hay señal, se usa lo guardado.
// Cambia CACHE_NAME en cada actualización de la página para que todos reciban lo nuevo.
const CACHE_NAME = 'fnf-mobile-v7.4.1';
const TIMEOUT_RED = 3000;

const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './privacidad.html',
  './terminos.html',
  './css/style.css',
  './js/boot.js',
  ...['icons', 'utils', 'render', 'ui-theme', 'home', 'firebase-config', 'extras', 'auth', 'profile', 'live', 'social', 'admin-forms',
      'downloads', 'favorites', 'requests', 'support', 'notifications', 'admin',
      'admin-users', 'admin-content', 'admin-avisos', 'admin-tools', 'admin-home'].map(f => `./js/modules/${f}.js`),
  './js/modules/data-apks.js',
  './js/modules/data-mods.js',
  './js/modules/data-scripts.js',
  './assets/icons/logo192.png',
  './assets/iconos/avatar-default.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // Se guardan uno por uno: si falta alguno, los demás sí quedan en caché
      .then(cache => Promise.allSettled(urlsToCache.map(u => cache.add(new Request(u, { cache: 'reload' })))))
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

const guardar = (req, res) => {
  if (res && (res.ok || res.type === 'opaque')) {
    const copy = res.clone();
    caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => { });
  }
  return res;
};

// Primero internet con límite de tiempo; si falla o tarda, lo guardado
function redPrimero(req) {
  return new Promise(resolve => {
    let listo = false;
    const usarCache = () => caches.match(req).then(r => r || caches.match('./index.html'));
    const timer = setTimeout(() => {
      caches.match(req).then(r => { if (r && !listo) { listo = true; resolve(r); } });
    }, TIMEOUT_RED);
    fetch(req)
      .then(res => { clearTimeout(timer); guardar(req, res); if (!listo) { listo = true; resolve(res); } })
      .catch(() => { clearTimeout(timer); if (!listo) { listo = true; resolve(usarCache()); } });
  });
}

// Lo guardado al instante y se actualiza por detrás para la próxima vez
function cacheYActualiza(req) {
  return caches.match(req).then(cached => {
    const red = fetch(req).then(res => guardar(req, res)).catch(() => cached);
    return cached || red;
  });
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const mismoSitio = url.origin === self.location.origin;
  const esFuente = url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com';
  if (!mismoSitio && !esFuente) return; // Firebase, YouTube, etc. van directo

  const estatico = esFuente || /\.(png|jpe?g|webp|gif|svg|ico|woff2?|ttf)$/i.test(url.pathname);
  event.respondWith(estatico ? cacheYActualiza(req) : redPrimero(req));
});
