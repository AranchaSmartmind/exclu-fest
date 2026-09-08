const CACHE = "la-exclusiva-pwa-v1";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Supabase y APIs: siempre red. No cachear respuestas privadas/dinámicas.
  if (url.hostname.includes("supabase.co") || url.pathname.startsWith("/rest/") || url.pathname.startsWith("/auth/")) {
    return;
  }

  // Navegación: red primero, fallback al shell.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => res)
        .catch(() => caches.match("/"))
    );
    return;
  }

  // Assets estáticos: cache primero.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((cache) => cache.put(req, copy));
      return res;
    }))
  );
});
