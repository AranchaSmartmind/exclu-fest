# EXCLU FEST — PWA para probar en iPhone gratis

Este paquete NO sustituye tu aplicación. Solo añade soporte PWA al proyecto existente `exclu-fest`.

## 1. Copia las carpetas
Copia `public` y `src/pwa.ts` dentro de:

C:\Users\Usuario\Desktop\exclu-fest

No borres nada de tu proyecto.

## 2. Modifica `index.html`
Dentro de `<head>` pega el contenido de `INDEX_HEAD_PWA.txt`.

## 3. Modifica `src/main.tsx`
Importa:

```ts
import { registerPWA } from "./pwa";
```

y después del `createRoot(...).render(...)` añade:

```ts
registerPWA();
```

## 4. Prueba primero en el PC

```powershell
cd C:\Users\Usuario\Desktop\exclu-fest
npm install
npm run dev -- --host 0.0.0.0
```

## 5. Abrirla en el iPhone con HTTPS gratis

La cámara del iPhone necesita HTTPS. Sin desplegar todavía la app definitiva puedes crear un enlace temporal.

En otra terminal, con Vite funcionando:

```powershell
npx localtunnel --port 5173
```

Te devolverá una dirección parecida a:

https://xxxxx.loca.lt

Ábrela con Safari en el iPhone.

## 6. Instalarla como app en el iPhone

En Safari:

Compartir → Añadir a pantalla de inicio → Añadir

Aparecerá el icono de La Exclusiva y se abrirá en modo app, sin la barra normal del navegador.

## 7. Qué debes probar

- Inicio y navegación
- Registro
- Supabase
- Ruleta / Quiz / Caja
- Pasaporte
- Juegos
- Mis premios
- Fotomatón y permiso de cámara
- Guardar/compartir fotografías
- Botón atrás
- Sonido
- Admin/canje

## IMPORTANTE

El Service Worker NO cachea las llamadas a Supabase. Los datos de participantes, premios y canjes siguen llegando al backend en tiempo real.

Para evitar que una versión antigua quede guardada durante las pruebas, si cambias mucho la app puedes cambiar:

`la-exclusiva-pwa-v1`

por:

`la-exclusiva-pwa-v2`

en `public/sw.js`.
