// Service worker : le jeu fonctionne hors ligne une fois chargé.
const VERSION = 'mm-v2';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css', 'assets/monocraft.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'js/main.js', 'js/noise.js', 'js/blocks.js', 'js/textures.js', 'js/worldgen.js', 'js/world.js',
  'js/storage.js', 'js/renderer.js', 'js/models.js', 'js/entities.js', 'js/inventory.js',
  'js/input.js', 'js/ui.js', 'js/game.js', 'js/audio.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

// Réseau d'abord (pour recevoir les mises à jour), cache si hors ligne.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })),
  );
});
