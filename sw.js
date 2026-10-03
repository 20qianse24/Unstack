// original code from https://github.com/danielcregg/pwa-template/blob/master/serviceWorker.js
// modified to cache the app shell and serve it when offline
const cacheName = 'unstack-cache-v1';
const filesToCache = [
  './',
  './index.html',
  './app.js',
  './static/css/styles.css',
  './manifest.json',
  './static/icons/ios/180.png',
  './static/icons/ios/192.png',
  './static/icons/ios/512.png'
];

// Install the service worker and save the main app files for offline use.
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install');
  event.waitUntil(
    caches.open(cacheName).then((cache) => {
      console.log('[Service Worker] Caching app shell');
      return cache.addAll(filesToCache);
    })
  );
  self.skipWaiting();
});

// Remove old caches when this worker takes control of the app.
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate');
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList
          .filter((key) => key !== cacheName)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Handle page requests so online users get updates and offline users get saved files.
self.addEventListener('fetch', (event) => {
  // Only cache GET requests and ignore unsupported schemes
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }
  // Use a network-first strategy for all requests, falling back to the cache if the network is unavailable.
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // If the network request is successful, clone the response and store it in the cache for future use.
        if (networkResponse.ok) {
          const responseClone = networkResponse.clone();
          caches.open(cacheName).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      //
      .catch(() =>
        caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return caches.match('./index.html');
        })
      )
  );
});
