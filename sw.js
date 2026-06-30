const CACHE_NAME = "porto-mhd-v1.6";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./js/state.js",
  "./js/weather.js",
  "./js/nearby.js",
  "./js/places.js",
  "./js/porto.js",
  "./js/planner.js",
  "./js/ui.js",
  "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
];

// Install Event
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log("Caching assets for offline use...");
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate Event (Cleanup old caches)
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log("Removing old cache:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event (Cache-First strategy)
self.addEventListener("fetch", event => {
  // Only handle local or CDN-cached network requests
  if (
    event.request.url.startsWith(self.location.origin) ||
    event.request.url.startsWith("https://cdn.jsdelivr.net")
  ) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)
          .then(networkResponse => {
            // Cache newly requested basic resources dynamically if appropriate
            if (
              networkResponse &&
              networkResponse.status === 200 &&
              networkResponse.type === "basic"
            ) {
              const cacheCopy = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, cacheCopy);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Offline fallback for navigation requests
            if (event.request.mode === "navigate") {
              return caches.match("./index.html");
            }
          });
      })
    );
  }
});
