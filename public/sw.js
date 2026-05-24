// Minimal service worker — cache-first for static assets, network for HTML.
// Lets the hub + games load offline after first visit.
// Version bump on every release so the activate handler purges stale caches.
const CACHE = 'wg-v2';
const STATIC = [
  './',
  './manifest.webmanifest',
  './icon-192.svg',
  './icon-512.svg',
];

// Pre-baked offline fallback HTML — shown when navigation fails AND nothing
// is cached for the requested URL (e.g. cold-start with no network).
const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Web Games — Offline</title>
<style>
  html,body{margin:0;height:100%;background:#0a0716;color:#f8f5ff;
    font-family:'Segoe UI',Roboto,system-ui,sans-serif;display:flex;
    align-items:center;justify-content:center;text-align:center;padding:24px}
  .box{max-width:420px}
  h1{font-family:'Press Start 2P',monospace;font-size:.95rem;color:#4cc9f0;
     letter-spacing:.12em;margin:0 0 10px}
  p{color:#c8c0e8;font-size:.95rem;line-height:1.5;margin:8px 0}
  button{margin-top:18px;background:linear-gradient(180deg,#4cc9f0,#2189b8);
    border:none;color:#0a0716;padding:12px 18px;border-radius:6px;
    font-family:'Press Start 2P',monospace;font-size:.55rem;letter-spacing:.1em;
    cursor:pointer}
</style></head><body><div class="box">
<h1>OFFLINE</h1>
<p>You're offline and this page hasn't been cached yet.</p>
<p>Visit the hub once while online — then every game works offline forever.</p>
<button onclick="location.reload()">RETRY</button>
</div></body></html>`;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // HTML: network-first (so updates are picked up), fallback to cache, then offline page.
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || new Response(
          OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        )))
    );
    return;
  }

  // Static assets: cache-first, fallback to network
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Cache successful same-origin responses
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
    })
  );
});
