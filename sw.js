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

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(cacheName).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return networkResponse;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
