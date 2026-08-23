const CACHE_NAME = "investment-dashboard-static-v1";
const APP_SHELL = ["./", "./index.html", "./manifest.webmanifest", "./data/dashboard.json"];
const DASHBOARD_URL = new URL("./data/dashboard.json", self.location.href).href;

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  const indexResponse = await fetch("./index.html", { cache: "no-store" });
  const indexHtml = await indexResponse.clone().text();
  const assetUrls = Array.from(indexHtml.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g), match => new URL(match[1], self.location.href).href);
  await cache.put(new URL("./index.html", self.location.href).href, indexResponse);
  await cache.addAll(["./", "./manifest.webmanifest", "./data/dashboard.json", ...assetUrls]);
}

self.addEventListener("install", event => {
  event.waitUntil(cacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("investment-dashboard-static-") && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone();
      void caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
      return response;
    }).catch(() => caches.match("./index.html").then(response => response || caches.match("./"))));
    return;
  }

  if (requestUrl.pathname.endsWith("/data/dashboard.json")) {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone();
      void caches.open(CACHE_NAME).then(cache => cache.put(DASHBOARD_URL, copy));
      return response;
    }).catch(() => caches.match(DASHBOARD_URL).then(response => response || caches.match("./data/dashboard.json"))));
    return;
  }

  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      void caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    }
    return response;
  })));
});
