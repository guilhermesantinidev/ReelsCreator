const CACHE_VERSION = 'reelai-v1';
const ASSETS_CACHE = 'reelai-assets-v1';
const API_CACHE = 'reelai-api-v1';

// Assets to cache on install
const CRITICAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './sw.js'
];

// ============================
// INSTALL
// ============================
self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      await cache.addAll(CRITICAL_ASSETS);
      await self.skipWaiting();
    })()
  );
});

// ============================
// ACTIVATE
// ============================
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(name => name !== CACHE_VERSION && name !== ASSETS_CACHE && name !== API_CACHE)
          .map(name => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

// ============================
// FETCH
// ============================
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // API calls - Network first with cache fallback
  if (url.hostname === 'api.groq.com' || url.hostname === 'fonts.googleapis.com') {
    event.respondWith(networkFirst(event.request, API_CACHE));
    return;
  }

  // CSS, JS, fonts - Cache first, network fallback
  if (
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.ttf')
  ) {
    event.respondWith(cacheFirst(event.request, ASSETS_CACHE));
    return;
  }

  // Images and media - Cache first, network fallback
  if (
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.webm') ||
    url.pathname.endsWith('.mp4') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.svg')
  ) {
    event.respondWith(cacheFirst(event.request, ASSETS_CACHE));
    return;
  }

  // HTML documents - Network first with cache fallback
  if (url.pathname.endsWith('.html') || url.pathname === self.registration.scope.replace(self.location.origin, '')) {
    event.respondWith(networkFirst(event.request, CACHE_VERSION));
    return;
  }

  // Default - Cache first for everything else
  event.respondWith(cacheFirst(event.request, CACHE_VERSION));
});

// ============================
// STRATEGIES
// ============================

/**
 * Cache first: return from cache, fallback to network
 */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline - Cache not available', { status: 503 });
  }
}

/**
 * Network first: try network, fallback to cache
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response('Offline - Network unavailable', { status: 503 });
  }
}

// ============================
// MESSAGE HANDLING
// ============================
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});