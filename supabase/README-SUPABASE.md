# Configuración de Supabase para EXCLU FEST

1. Crea un proyecto.
2. Authentication > Providers > Phone > activa Phone.
3. Configura el proveedor SMS que vayas a utilizar.
4. Ejecuta `migrations/001_exclu_fest.sql` en SQL Editor.
5. Crea el teléfono administrador desde Auth.
6. Copia el UUID del usuario administrador.
7. Ejecuta:

   insert into public.admin_users(user_id)
   values('TU-UUID');

8. En el frontend utiliza únicamente:
   - Project URL
   - anon/public key

Nunca pongas la service_role key en VITE_ ni en el navegador.

## Validación de premios

El esquema incluye `redeem_reward(code)`. Para añadir la pantalla de validación de camareros, el frontend puede llamar esa RPC desde una cuenta administradora. La versión inicial del panel ya protege el acceso por `admin_users`.

## SMS

El OTP por teléfono depende de tener configurado un proveedor SMS en Supabase. La aplicación no contiene credenciales de un proveedor externo.

## Protección contra duplicados

`participants` tiene `unique(festival_id,user_id)` y `play_game()` utiliza esa restricción. Así una recarga o doble clic no puede generar dos participaciones para la misma cuenta.

## Control de stock

`play_game()` selecciona y actualiza el premio dentro de una función PostgreSQL con bloqueo de filas. No se confía en el navegador para decidir qué premio queda.
