
const CACHE_NAME = 'taipei-journey-v2';
const URLS_TO_CACHE = [
  './',
  './index.html',
  './index.tsx',
  // Add other critical assets if known
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE);
    })
  );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;
    
    // Skip cross-origin requests that might be API calls unless you want to cache them
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // If valid response, clone and cache it
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // Network failed, try cache
                return caches.match(event.request).then((response) => {
                    if (response) {
                        return response;
                    }
                    // Optional: Return a custom offline page here if navigation
                    return null;
                });
            })
    );
});
