// Offline-Cache: Seite netzwerk-zuerst, Assets/Namen/Katalog cache-zuerst (Katalog auf 80 Shards begrenzt).
const V = 'combo-v2';
const SHARDS = 'combo-shards-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(['./', './names.txt', './manifest.webmanifest', './icon-192.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== V && k !== SHARDS).map((k) => caches.delete(k)))));
  self.clients.claim();
});

async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  if (e.request.mode === 'navigate') {
    // Unter der eigenen Adresse cachen (ohne Hash), sonst würde about.html die Startseite überschreiben
    const key = url.origin + url.pathname;
    e.respondWith(fetch(e.request).then((r) => {
      const copy = r.clone();
      if (r.ok) caches.open(V).then((c) => c.put(key, copy));
      return r;
    }).catch(async () => (await caches.match(key)) ?? caches.match('./')));
    return;
  }

  const isShard = url.pathname.includes('/api/v1/combos/');
  const cacheName = isShard ? SHARDS : V;
  e.respondWith(caches.open(cacheName).then(async (c) => {
    const hit = await c.match(e.request);
    if (hit) return hit;
    const r = await fetch(e.request);
    if (r.ok && (isShard || url.pathname.includes('/assets/') || url.pathname.endsWith('names.txt'))) {
      await c.put(e.request, r.clone());
      if (isShard) trim(c, 80);
    }
    return r;
  }));
});
