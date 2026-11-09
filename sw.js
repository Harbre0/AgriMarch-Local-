/* AgriMarchéLocal — service worker
   - HTML : cache d'abord pour une ouverture instantanée (même sur réseau lent), mise à jour en
     arrière-plan : la dernière version est visible dès l'ouverture suivante ; hors ligne : cache
   - icônes / manifest : cache d'abord
   - Supabase, CDN et tout ce qui est externe : jamais intercepté */
const VERSION = 'aml-sw-v2';
const SHELL = ['./', './index.html', './manifest.json', './icon-v2-192.png', './icon-v2-512.png'];

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
      const cached = await cache.match('./index.html');
      const update = fetch(req)
        .then((res) => { if (res && res.ok) { cache.put('./index.html', res.clone()); } return res; })
        .catch(() => null);
      if (cached) { e.waitUntil(update); return cached; }
      const res = await update;
      return res || (await caches.match(req)) || Response.error();
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
