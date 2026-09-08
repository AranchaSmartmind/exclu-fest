export function registerPWA() {
  // DESARROLLO:
  // elimina cualquier Service Worker antiguo y sus cachés.
  if (!import.meta.env.PROD) {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => {
          registrations.forEach((registration) => {
            registration.unregister();
          });
        })
        .catch(console.warn);
    }

    if ("caches" in window) {
      caches.keys()
        .then((keys) => {
          keys.forEach((key) => {
            caches.delete(key);
          });
        })
        .catch(console.warn);
    }

    console.log("PWA: caché y Service Workers desactivados en desarrollo");
    return;
  }

  // PRODUCCIÓN
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {
        console.log("PWA registrada correctamente");
      })
      .catch((error) => {
        console.warn(
          "No se pudo registrar el Service Worker:",
          error
        );
      });
  });
}

