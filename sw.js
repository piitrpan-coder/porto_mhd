const CACHE_NAME = "porto-mhd-v1.6";
const TILES_CACHE = "porto-tiles-v1";

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

// Activate Event — keep both app cache and tiles cache
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME && key !== TILES_CACHE) {
            console.log("Removing old cache:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener("fetch", event => {
  const url = event.request.url;

  // OSM tile requests — cache-first from TILES_CACHE
  if (url.includes("tile.openstreetmap.org")) {
    event.respondWith(
      caches.open(TILES_CACHE).then(cache =>
        cache.match(event.request).then(cached => {
          if (cached) return cached;
          return fetch(event.request).then(resp => {
            if (resp && resp.status === 200) {
              cache.put(event.request, resp.clone());
            }
            return resp;
          }).catch(() => undefined);
        })
      )
    );
    return;
  }

  // App shell and CDN resources — cache-first
  if (
    url.startsWith(self.location.origin) ||
    url.startsWith("https://cdn.jsdelivr.net")
  ) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)
          .then(networkResponse => {
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
            if (event.request.mode === "navigate") {
              return caches.match("./index.html");
            }
          });
      })
    );
  }
});
