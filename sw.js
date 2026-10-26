/* Service worker — AgriMarchéLocal
   - Coquille de l'app (index, manifeste, icônes) : disponible hors connexion.
   - Pages : réseau d'abord (toujours la dernière version), cache en secours.
   - Bibliothèques CDN : cache d'abord.
   - Supabase et toute autre API : jamais interceptées (l'app gère déjà son propre cache). */
const VERSION = 'aml-v1';
const SHELL = `${VERSION}-shell`;
const CDN = `${VERSION}-cdn`;
const SHELL_FILES = ['./', './index.html', './manifest.json', './icon-v2-192.png', './icon-v2-512.png'];
const CDN_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((c) => Promise.all(SHELL_FILES.map((u) => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('aml-v') && !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Bibliothèques et polices CDN : cache d'abord
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(CDN).then((c) =>
        c.match(req).then((hit) => hit || fetch(req).then((res) => {
          if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
          return res;
        }))
      ).catch(() => caches.match(req))
    );
    return;
  }

  // Tout le reste hors du site (Supabase, APIs…) : on ne touche à rien
  if (url.origin !== self.location.origin) return;

  // Pages : réseau d'abord, cache en secours
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(SHELL).then((c) => c.put('./index.html', copy));
        return res;
      }).catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Fichiers du site (icônes, manifeste) : cache puis mise à jour en arrière-plan
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(SHELL).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
