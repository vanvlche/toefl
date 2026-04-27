const CACHE_NAME = "toefl-vocab-pwa-v7";
const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./data/seed_words.json"
];

function isSeedRequest(url) {
  return url.pathname.endsWith("/data/seed_words.json");
}

function normalizedSeedRequest(request) {
  const url = new URL(request.url);
  url.search = "";
  return new Request(url.toString(), {
    credentials: request.credentials,
    headers: request.headers,
    method: "GET"
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => (
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isSeedRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(normalizedSeedRequest(request), copy));
          }
          return response;
        })
        .catch(() => (
          caches.match(normalizedSeedRequest(request)).then((cached) => (
            cached || new Response("", { status: 504, statusText: "Offline" })
          ))
        ))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          if (request.mode === "navigate") {
            return caches.match("./index.html");
          }
          return new Response("", { status: 504, statusText: "Offline" });
        });
    })
  );
});
