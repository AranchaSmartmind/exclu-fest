# EXCLU FEST

Proyecto React + Vite + Supabase para la promoción de Cafetería La Exclusiva.

## Carpeta de trabajo
Este paquete está preparado para copiarse directamente dentro de la carpeta existente:

`Desktop/exclu-fest`

No hace falta crear otra carpeta y no incluye `.git`, por lo que tu repositorio actual se conserva.

## Arranque local
Abre una terminal dentro de `exclu-fest` y ejecuta:

```bash
npm install
npm run dev
```

Después abre la URL que muestre Vite, normalmente:

`http://localhost:5173/`

Panel administrador:

`http://localhost:5173/admin`

## Supabase
La conexión está configurada mediante `.env.local`.

La migración de reparación que ya ejecutaste está en:

`supabase/002_reset_exclu_fest.sql`

No vuelvas a ejecutarla salvo que quieras borrar y recrear únicamente las tablas de EXCLU FEST.

## Seguridad
`.env.local` está incluido en `.gitignore` para que no se suba a GitHub.
Nunca añadas una `service_role` al frontend.
