const CACHE = "winess-hub-v303";
const APP_BASE_URL = "https://steven77726.github.io/WINESS-HUB/";
const ASSETS = ["./", "./index.html", "./styles.css", "./app.js", "./task-status.js", "./manifest.webmanifest", "./assets/winess-icon.svg"];

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
    data: { url: safeNotificationUrl(data.url) }
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = safeNotificationUrl(event.notification.data?.url);
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
    const existing = clients.find((client) => client.url.startsWith(APP_BASE_URL));
    if (existing) {
      await existing.navigate(targetUrl).catch(() => existing.navigate(APP_BASE_URL));
      return existing.focus();
    }
    return self.clients.openWindow(targetUrl).catch(() => self.clients.openWindow(APP_BASE_URL));
  }));
});

function safeNotificationUrl(value) {
  if (!value) return APP_BASE_URL;
  try {
    const source = String(value).startsWith("#") ? `index.html${value}` : String(value);
    const candidate = new URL(source, APP_BASE_URL);
    if (candidate.origin !== "https://steven77726.github.io" || !candidate.pathname.startsWith("/WINESS-HUB/")) return APP_BASE_URL;
    return candidate.href;
  } catch {
    return APP_BASE_URL;
  }
}
