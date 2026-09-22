/* ==========================================================================
   Bunk Meter — sw.js (service worker)
   Runs in the background, separate from the page. Its job is to cache the
   app's files so the app still opens (and works, since all data is local)
   with no internet connection.

   Strategy: "cache first, falling back to network". On install we cache the
   whole app shell; after that we serve files straight from that cache and
   only hit the network if something is missing from it.

   Bump CACHE_NAME whenever you change any cached file — that's what makes
   the browser fetch and store the new versions.
   ========================================================================== */

const CACHE_NAME = "bunkmeter-cache-v3";

const APP_SHELL = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Only handle simple GET requests; let everything else pass through.
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // Save a copy of newly-fetched files for next time we're offline.
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => {
          // Offline and not cached: fall back to the app shell for page navigations.
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
    })
  );
});
