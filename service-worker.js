
const CACHE_NAME = 'taipei-journey-v1';
// In a production environment, we would be more specific.
// Here we aggressively cache visited pages to ensure basic offline functionality.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // We only want to handle GET requests
    if (event.request.method !== 'GET') return;
    
    // Skip cross-origin requests for now to avoid opaque response issues
    // unless it's a critical asset we want to try to cache.
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Check if we received a valid response
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }

                // Clone the response
                const responseToCache = response.clone();

                caches.open(CACHE_NAME)
                    .then((cache) => {
                        cache.put(event.request, responseToCache);
                    });

                return response;
            })
            .catch(() => {
                // If fetch fails (offline), try to return from cache
                return caches.match(event.request);
            })
    );
});
