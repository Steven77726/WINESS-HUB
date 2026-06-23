const CACHE = "winess-hub-v260";
const ASSETS = ["./", "./index.html", "./styles.css", "./app.js", "./manifest.webmanifest", "./assets/winess-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then((response) => response || caches.match("./index.html"))));
});

self.addEventListener("push", (event) => {
  const data = event.data?.json?.() || {};
  event.waitUntil(self.registration.showNotification(data.title || "Winess Hub", {
    body: data.body || "Nouvelle activité",
    icon: "assets/winess-icon.svg",
    data: { url: data.url || "./index.html#accueil" }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url || "./index.html#accueil"));
});
