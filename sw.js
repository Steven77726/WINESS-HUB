const CACHE = "winess-hub-v292";
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
    badge: "assets/winess-icon.svg",
    tag: data.event_id || undefined,
    renotify: false,
    data: { url: data.url || "./index.html#accueil" }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "./index.html#accueil", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
    const existing = clients.find((client) => client.url.startsWith(self.location.origin));
    if (existing) {
      await existing.navigate(targetUrl).catch(() => existing.navigate(new URL("./index.html#accueil", self.location.origin).href));
      return existing.focus();
    }
    return self.clients.openWindow(targetUrl).catch(() => self.clients.openWindow("./index.html#accueil"));
  }));
});
