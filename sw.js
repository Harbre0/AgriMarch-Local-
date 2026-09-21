// Service worker AgriMarchéLocal
// Stratégie : toujours essayer le réseau en premier (pour avoir la dernière version
// de l'app dès qu'elle est en ligne), et se replier sur le cache seulement si hors-ligne.
// Change ce numéro de version à chaque fois que tu veux forcer un rafraîchissement du cache.
const CACHE_NAME = 'agrimarchelocal-cache-v1';
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // On ne gère que les requêtes GET (les appels Supabase/API restent normaux)
  if (req.method !== 'GET') return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Met à jour le cache avec la réponse fraîche du réseau
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        return res;
      })
      .catch(() =>
        // Hors-ligne : on sert la version en cache si disponible
        caches.match(req).then((cached) => cached || caches.match('./index.html'))
      )
  );
});
