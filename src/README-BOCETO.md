# EXCLU FEST — diseño calcado al boceto

Esta actualización está preparada para copiar su contenido directamente dentro de tu carpeta existente:

C:\Users\Usuario\Desktop\exclu-fest

## Qué hace
- La portada utiliza el boceto aprobado como composición exacta.
- Las zonas de la portada son clicables y abren: ruleta, reto, caja fuerte, pasaporte, fotomatón y premios.
- Usa el robot EXCLU aportado para las pantallas interactivas.
- Mantiene la conexión existente a Supabase mediante `src/lib/supabase.ts`.
- Mantiene OTP por teléfono y llamada a `play_game`.

## Instalación
1. Haz copia de seguridad de tu carpeta `exclu-fest`.
2. Copia todos estos archivos encima de esa carpeta.
3. Conserva tu `.env.local` actual.
4. Ejecuta:
   npm install
   npm run dev
5. Abre http://localhost:5173

## Importante
La portada está deliberadamente construida sobre la imagen aprobada para que sea visualmente idéntica al boceto. Las zonas transparentes superpuestas la convierten en navegación real.
