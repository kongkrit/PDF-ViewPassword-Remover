const CACHE_VERSION = 'v6';
const CACHE_NAME = 'pdf-unlocker-' + CACHE_VERSION;

const PRECACHE = [
  '.',
  'index.html',
  'styles.css',
  'app.js',
  'worker.js',
  'manifest.webmanifest',
  'vendor/qpdf/qpdf.js',
  'vendor/qpdf/qpdf.wasm',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request)
      .then((cached) => cached ?? fetch(e.request))
  );
});
