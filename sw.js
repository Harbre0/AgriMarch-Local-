/* AgriMarchéLocal — service worker
   - HTML : réseau d'abord (la dernière version s'affiche dès l'ouverture après un déploiement) ;
     si le réseau est lent (> 4 s) ou absent : version en cache
   - icônes / manifest : cache d'abord
   - Supabase, CDN et tout ce qui est externe : jamais intercepté
   Pour forcer la mise à jour chez tous les utilisateurs : changer VERSION à chaque déploiement. */
const VERSION = 'aml-sw-v3';
const SHELL = ['./', './index.html', './manifest.json', './icon-v2-192.png', './icon-v2-512.png'];
const NET_TIMEOUT = 4000;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isPage = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  if (isPage) {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const net = fetch(req, { cache: 'no-store' })
        .then((res) => { if (res && res.ok) { cache.put('./index.html', res.clone()); } return res; });
      const timeout = new Promise((r) => setTimeout(() => r(null), NET_TIMEOUT));
      try {
        const res = await Promise.race([net, timeout]);
        if (res) return res;
      } catch (err) { /* hors ligne */ }
      const cached = await cache.match('./index.html');
      if (cached) { e.waitUntil(net.catch(() => null)); return cached; }
      try { return await net; } catch (err) { return Response.error(); }
    })());
    return;
  }

  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});
