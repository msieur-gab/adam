/**
 * Service Worker for ADAM
 * Caches the Kokoro TTS model and app assets for offline use
 */

const CACHE_VERSION = 'adam-v1';
const KOKORO_MODEL_CACHE = 'kokoro-models-v1';
const APP_CACHE = 'adam-app-v1';

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// HuggingFace model URLs to cache (these are large files)
const MODEL_URL_PATTERNS = [
  'huggingface.co',
  'cdn-lfs.huggingface.co',
  'cdn.huggingface.co'
];

/**
 * Install event - precache essential assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => {
      console.log('[SW] Precaching app assets');
      return cache.addAll(PRECACHE_ASSETS);
    })
  );

  // Skip waiting to activate immediately
  self.skipWaiting();
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old caches that don't match current version
          if (cacheName !== APP_CACHE &&
              cacheName !== KOKORO_MODEL_CACHE &&
              cacheName.startsWith('adam-')) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  // Take control of all clients immediately
  return self.clients.claim();
});

/**
 * Fetch event - implement caching strategy
 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Check if this is a Kokoro model request
  const isModelRequest = MODEL_URL_PATTERNS.some(pattern =>
    url.hostname.includes(pattern)
  );

  if (isModelRequest) {
    // Cache-first strategy for model files (they're immutable)
    event.respondWith(handleModelRequest(event.request));
  } else {
    // Network-first strategy for app assets (allows updates)
    event.respondWith(handleAppRequest(event.request));
  }
});

/**
 * Handle Kokoro model requests with cache-first strategy
 * Models are large (82MB) and immutable, so aggressive caching is beneficial
 */
async function handleModelRequest(request) {
  try {
    // Try cache first
    const cache = await caches.open(KOKORO_MODEL_CACHE);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      console.log('[SW] Model cache hit:', request.url.split('/').pop());
      return cachedResponse;
    }

    // Not in cache, fetch from network
    console.log('[SW] Fetching model from network:', request.url.split('/').pop());
    const response = await fetch(request);

    // Cache if successful
    if (response.ok) {
      // Clone the response before caching
      const responseToCache = response.clone();

      // Cache asynchronously (don't block response)
      cache.put(request, responseToCache).then(() => {
        console.log('[SW] Cached model file:', request.url.split('/').pop());
      });
    }

    return response;

  } catch (error) {
    console.error('[SW] Model fetch failed:', error);
    // Try to return cached version as fallback
    const cache = await caches.open(KOKORO_MODEL_CACHE);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('[SW] Returning cached model (offline)');
      return cachedResponse;
    }
    throw error;
  }
}

/**
 * Handle app requests with network-first strategy
 * This ensures users always get the latest app version
 */
async function handleAppRequest(request) {
  try {
    // Try network first
    const response = await fetch(request);

    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(APP_CACHE);
      cache.put(request, response.clone());
    }

    return response;

  } catch (error) {
    // Network failed, try cache
    const cache = await caches.open(APP_CACHE);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      console.log('[SW] Returning cached app asset (offline)');
      return cachedResponse;
    }

    throw error;
  }
}

/**
 * Message handler for cache management
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      }).then(() => {
        console.log('[SW] All caches cleared');
        return self.clients.matchAll();
      }).then((clients) => {
        clients.forEach(client => client.postMessage({
          type: 'CACHE_CLEARED'
        }));
      })
    );
  }

  if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    event.waitUntil(
      getCacheSize().then((size) => {
        event.ports[0].postMessage({
          type: 'CACHE_SIZE',
          size: size
        });
      })
    );
  }
});

/**
 * Get total cache size for monitoring
 */
async function getCacheSize() {
  let totalSize = 0;
  const cacheNames = await caches.keys();

  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();

    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
  }

  return totalSize;
}

console.log('[SW] Service worker loaded');
