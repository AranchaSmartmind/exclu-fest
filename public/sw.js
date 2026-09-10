const CACHE = "la-exclusiva-pwa-v2";

const APP_SHELL = [
  "/exclu-fest/",
  "/exclu-fest/manifest.webmanifest",
  "/exclu-fest/icons/icon-192.png",
  "/exclu-fest/icons/icon-512.png",
  "/exclu-fest/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => undefined)
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE)
            .map((key) => caches.delete(key))
        )
      )
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Ignorar chrome-extension://, moz-extension:// y cualquier esquema
  // que no sea HTTP/HTTPS.
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return;
  }

  // Supabase y APIs dinámicas: siempre red, nunca caché.
  if (
    url.hostname.includes("supabase.co") ||
    url.pathname.startsWith("/rest/") ||
    url.pathname.startsWith("/auth/")
  ) {
    return;
  }

  // Navegación: red primero y shell como respaldo.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/exclu-fest/"))
    );
    return;
  }

  // Solo cachear recursos del propio sitio.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Assets estáticos: caché primero.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req).then((res) => {
        // Solo guardar respuestas válidas.
        if (!res || !res.ok) {
          return res;
        }

        const copy = res.clone();

        caches
          .open(CACHE)
          .then((cache) => cache.put(req, copy))
          .catch(() => undefined);

        return res;
      });
    })
  );
});