# EXCLU FEST — actualización sin SMS

Esta actualización elimina Phone OTP y usa **Supabase Anonymous Auth** como sesión técnica gratuita. El teléfono se solicita únicamente como identificador declarado para evitar duplicados; no se envía ningún SMS y no se guarda el número en claro en las tablas de EXCLU FEST (se guarda SHA-256 + últimos 3 dígitos enmascarados).

## 1. Activar Anonymous Sign-Ins en Supabase

En Supabase abre:

Authentication → Providers → Anonymous Sign-Ins

y actívalo.

No necesitas Twilio ni otro proveedor SMS.

## 2. Ejecutar la migración 003

SQL Editor → New query → pega y ejecuta:

`supabase/migrations/003_no_sms_daily_participation.sql`

Debe terminar con `Success. No rows returned`.

No vuelvas a ejecutar 002.

## 3. Copiar archivos

Copia el contenido de este ZIP directamente dentro de tu carpeta existente:

`C:\Users\Usuario\Desktop\exclu-fest`

Conserva `.git` y tu `.env.local`.

## 4. Arrancar

```bash
npm install
npm run dev
```

## 5. Modo prueba

La migración deja `test_mode=true`, de modo que podrás probar los juegos 11, 12 y 13 antes de septiembre.

Antes de publicar en producción ejecuta:

```sql
update public.festivals
set test_mode=false
where slug='exclu-fest-2026';
```

## Seguridad / limitación importante

Sin SMS no existe verificación real de que el teléfono pertenezca a la persona. El sistema sí impide usar el mismo teléfono declarado en varias sesiones y guarda la lógica de premios/stock en PostgreSQL, pero alguien podría introducir un número ajeno. Para una promoción local esto evita el coste de SMS y reduce fricción, pero no equivale a Phone OTP.
