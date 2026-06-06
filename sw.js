// Ricoh Offerte Studio Pro - Service Worker
// Versie: 1.0

var CACHE = "ricoh-offerte-v1";
var ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

// Installatie: cache alle assets
self.addEventListener("install", function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activatie: verwijder oude caches
self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

// Fetch: cache-first voor app-bestanden, network-first voor API-calls
self.addEventListener("fetch", function(e) {
  var url = e.request.url;
  
  // API-calls nooit cachen (Gemini, Anthropic)
  if(url.includes("generativelanguage.googleapis.com") ||
     url.includes("api.anthropic.com")) {
    e.respondWith(fetch(e.request));
    return;
  }
  
  // App-bestanden: cache-first
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if(cached) return cached;
      return fetch(e.request).then(function(response) {
        // Cache nieuwe bestanden dynamisch
        if(response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      }).catch(function() {
        // Offline fallback
        return caches.match("/index.html");
      });
    })
  );
});
