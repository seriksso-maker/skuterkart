const SHELL = 'sk-shell-v2';
const TILES = 'sk-tiles-v1';
const SHELL_FILES = ['./', './index.html', './manifest.json'];
const TILE_HOSTS = /(tile\.opentopomap\.org|tile\.openstreetmap\.org|elevation-tiles-prod|s3\.amazonaws\.com|server\.arcgisonline\.com|tiles\.opensnowmap\.org|tile-cyclosm\.openstreetmap\.fr|basemaps\.cartocdn\.com)/;
const STATIC_HOSTS = /(unpkg\.com)/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('sk-shell-') && k !== SHELL).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Kartfliser: cache først, så nett (lagres automatisk)
  if (TILE_HOSTS.test(url.hostname)) {
    e.respondWith((async () => {
      const cache = await caches.open(TILES);
      const hit = await cache.match(req, { ignoreVary: true });
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
      } catch {
        return new Response('', { status: 504 });
      }
    })());
    return;
  }

  // App-skall og bibliotek: bruk cache, oppdater i bakgrunnen
  if (url.origin === location.origin || STATIC_HOSTS.test(url.hostname)) {
    e.respondWith((async () => {
      const cache = await caches.open(SHELL);
      const hit = await cache.match(req, { ignoreSearch: true });
      const net = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
      return hit || (await net) || new Response('Offline', { status: 503 });
    })());
  }
  // Alt annet (Overpass, vær, søk) går rett til nettet
});
