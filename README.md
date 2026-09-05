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


## Versión 012
Corrige la Home para usar la portada final de La Exclusiva tanto en móvil como en escritorio. El antiguo DesktopPoster ya no aparece en Inicio.

## 014 · Home funcional
- Se elimina la barra de estado ficticia (hora, cobertura, Wi‑Fi y batería) incrustada en el mockup.
- El botón de sonido de la Home es un control real con estado ON/OFF persistente.
- Jugar ahora, Ver mis premios, Inicio, Pasaporte, Arcade y Fotomatón mantienen navegación funcional.
- Sin cambios en Supabase, premios, juegos ni panel de administración.

- 015: Se elimina visualmente el altavoz duplicado del fondo de la Home y queda un único botón de sonido funcional.

## Versión 016 · Jugar ahora + navegación unificada
- `¡JUGAR AHORA!` abre una pantalla funcional con los juegos diarios de los días 11, 12 y 13.
- En modo test se pueden seleccionar los tres días desde los indicadores; en producción solo se habilita el día real.
- El logo de La Exclusiva se reutiliza exactamente desde la Home aprobada (`logo-la-exclusiva-approved.png`).
- La navegación inferior queda unificada en todas las pantallas: Inicio / Pasaporte / Juegos / Fotomatón.
- El icono de Pasaporte conserva el ticket rosa aprobado y no cambia.
- `Arcade` pasa a mostrarse como `Juegos`, conservando el icono de mando.
- Se añade una pantalla Juegos para acceder a EXCLU Vuela, Rasca EXCLU, Encuentra a EXCLU, Memoria EXCLU y Lanza Aros.
- No hay cambios en las migraciones ni en la lógica segura de Supabase.

## Versión 017 · Jugar Ahora idéntico al boceto
La pantalla «Jugar Ahora» usa el boceto aprobado como composición visual exacta y añade controles HTML funcionales superpuestos (volver, sonido, CTA del juego, pasaporte y navegación). El icono de Pasaporte y la etiqueta «Juegos» se mantienen coherentes con el diseño aprobado. No modifica Supabase ni las migraciones.


## Versión 018 · Ajustes de navegación y composición
- Un solo botón de sonido real y más pequeño en Jugar Ahora.
- La flecha de los juegos diarios vuelve a Jugar Ahora.
- La flecha de Jugar Ahora vuelve a Inicio y queda alineada.
- Pasaporte alineado y checks centrados.
- Logo oficial de La Exclusiva superpuesto en la pantalla Jugar Ahora.

## 019 - Ajustes de navegación y Pasaporte
- Corrige la proporción real del boceto Jugar Ahora (853×1844).
- Sustituye logo de la pantalla Jugar Ahora por el logo aprobado de Home.
- Deja un solo altavoz real y funcional.
- Sustituye la flecha dibujada por un botón real que vuelve a Home.
- Recoloca las marcas del Pasaporte.
- Sustituye el icono tipo ticket por un icono tipo pasaporte/libro en Home, Jugar Ahora y navegación interna.


## Versión 020
Corrección de duplicados visuales: un solo logo, un solo altavoz funcional, flecha de volver con hotspot real y Pasaporte unificado en Home/Hub.

## 021 · Icono Pasaporte definitivo
- Sustituido el icono rosa/ticket por un pasaporte lineal propio con globo y texto «PASAPORTE».
- Gris neutro cuando está inactivo y dorado cuando está seleccionado.
- Mismo SVG reutilizado en Home, Jugar Ahora y navegación interna.
- Sin cambios en Supabase, premios ni lógica de juegos.

## Versión 022
- Hub «Jugar ahora» usa el boceto final aprobado como única imagen visual.
- Flecha y altavoz del boceto son controles reales mediante hotspots transparentes; no se duplican.
- Pasaporte del menú sin texto interior y sin tapar la etiqueta.
- Contador de Fotomatón dinámico: 0 no muestra badge; 1,2,3… refleja fotos tomadas en este dispositivo y persiste en localStorage.
- Se elimina el `1`/`*` fijo del Fotomatón mediante máscara y se superpone solo el contador real.

## Versión 023
Ajustes visuales finos: flecha y sonido más discretos en Jugar Ahora, puntos decorativos retirados, icono de Pasaporte igual al boceto aprobado en toda la app y máscaras del badge de Fotomatón reducidas para no recortar la cámara.

## Versión 024
- Barra inferior única, fija y funcional en todas las pantallas: Inicio · Pasaporte · Juegos · Fotomatón.
- Mismo icono de Pasaporte en Home, Jugar Ahora y pantallas internas.
- Fotomatón usa badge rojo `*` dinámico: oculto con 0 fotos y visible cuando el cliente ya tiene fotos.
- Slider del Hub restaurado con tres puntos funcionales sin tapar la línea inferior de la tarjeta.

## Versión 025
- Home: eliminada visualmente la navegación duplicada de la imagen; queda una sola barra real.
- Navegación: misma barra fija y mismo tamaño en todas las pantallas.
- Iconos: Inicio/Juegos/Fotomatón aumentados para igualar el estilo visual aprobado; Pasaporte conserva el icono aprobado de la segunda pantalla.
- Slider: los puntos originales del arte se ocultan sin cortar la línea cyan y los controles funcionales se sitúan dentro de la tarjeta.

## Versión 026
- Eliminado el slider de "¿Qué juego hay hoy?".
- Juego activo automático por fecha: 11 Ruleta, 12 Reto del Coto, 13 Cofre, de 00:00 a 23:59 hora local.
- En test mode se puede forzar el día con `localStorage.exclu_test_day` (11, 12 o 13), sin mostrar selector al cliente.
- Navegación inferior única, no fija, integrada al final de todas las pantallas.
- Home completa sin recorte superior y sin navegación duplicada.

## 027 · Home final aprobada
- Sustituida la Home por el boceto final aprobado con el nuevo EXCLU.
- Eliminados los parámetros del teléfono del arte.
- Botones JUGAR AHORA, VER MIS PREMIOS, PASAPORTE y SONIDO son funcionales mediante hotspots reales.
- La navegación dibujada en la imagen se oculta para evitar duplicados y se usa una única navegación React integrada en todas las pantallas.
- Pasaporte actualizado al icono aprobado.
- El badge `*` del Fotomatón sigue siendo dinámico: solo aparece cuando existen fotos del cliente.

## Versión 028
- Home simplificada: se elimina el bloque "TU PASAPORTE EXCLU" de la Home; permanece en la segunda pantalla.
- El juego del día ya no muestra slider/carrusel visual.
- Se mantienen los juegos automáticos por fecha y la navegación común funcional.


## 030 · Borde Ruleta
Se corrige exclusivamente el tramo inferior del borde cyan de la tarjeta del juego del día: cerrado, alineado y con el mismo grosor visual que el borde original.

## Versión 031 · Navegación única
- Eliminada la navegación dibujada duplicada del arte de Jugar Ahora.
- Una sola barra real `BottomNav` en todas las pantallas.
- Formato visual unificado: icono arriba y texto abajo.
- Inicio, Juegos y Fotomatón usan iconos lineales grandes; Pasaporte conserva el icono elegido.
- Badge rojo `*` del Fotomatón sigue siendo dinámico.

## 032 · Ajuste mobile-only
- La aplicación se normaliza a un lienzo móvil máximo de 430 px.
- Jugar Ahora deja de usar min-height:100dvh para evitar solapes con la navegación.
- La navegación inferior usa exactamente el mismo tamaño en Home y Jugar Ahora.
- Formato común: icono arriba + texto debajo.

## Versión 033
- Segunda pantalla: tarjeta del juego con borde cyan uniforme, sin restos del antiguo slider.
- Pasaporte completo con borde dorado inferior visible.
- Navegación inferior con radio de esquina armonizado con el resto de recuadros.


## Versión 034
- RULETA (sin EXCLU).
- TU PASAPORTE (sin EXCLU).
- Ruleta negro/blanco/dorado.
- CTA sin artefacto duplicado y navegación móvil sin solapes.

## 038 · Hub estable desde el diseño aprobado
- Se descarta la reconstrucción HTML de las cards que provocaba solapes.
- Cabecera, Ruleta y Pasaporte usan directamente los diseños aprobados por la usuaria.
- Botón de juego y estados 11/12/13 son funcionales mediante overlays mínimos.
- Antes del 11 de septiembre los tres días permanecen bloqueados; cada día se abre en su fecha (Europe/Madrid).

## Versión 039 · corrección de apilado móvil
- Corrige la herencia antigua de `display:flex` que hacía que cabecera, Ruleta y Pasaporte apareciesen en una sola fila y minúsculos.
- Jugar Ahora queda forzado a una sola columna para cualquier ancho de viewport.
- Mantiene exactamente los assets visuales aprobados `game-card-user.png` y `passport-card-user.png`.
- Recoloca los estados dinámicos del pasaporte al centro real de sus círculos.
- No modifica Supabase ni la lógica de participación.

## 040 · Cabecera nítida y Pasaporte bloqueado real
- La cabecera de Jugar Ahora ya no usa la captura reducida: se sirve desde un recorte 1065 px del arte aprobado.
- La tarjeta `TU PASAPORTE` usa la referencia aprobada 394x160.
- Los tres círculos son estados dinámicos; antes del 11/09/2026 los tres aparecen bloqueados aunque exista estado de pruebas previo.
- El 11, 12 y 13 se abren únicamente en su fecha; los completados se muestran con check.

### 041 · Ajuste mínimo de cabecera y fecha
- Se eliminan visualmente los controles React duplicados de volver/sonido; siguen siendo hotspots funcionales sobre los iconos ya dibujados.
- La fecha de la tarjeta de Ruleta se calcula en `Europe/Madrid` y se muestra dinámicamente como HOY / día / mes.
- No se modifica ningún otro bloque visual ni la lógica de Supabase.

- 042: flecha y altavoz visibles, pequeños y únicos; se mantiene fecha real dinámica.

- 043: controles superiores sin duplicado: se usan los iconos pequeños del arte aprobado y los botones React quedan como hotspots transparentes funcionales.

### 044 · Controles de cabecera
- Flecha y altavoz visibles, pequeños y funcionales.
- El botón React cubre exactamente el control impreso para evitar doble borde/solape.
- No se modifica ninguna otra parte del Hub.

- 045: corregido exclusivamente el pequeño solape residual de la flecha Atrás del Hub; no se modifica ningún otro componente.

## 052 · Popup de premio de Ruleta
- Popup sobre la propia Ruleta, sin abandonar la pantalla.
- Confeti dorado animado mientras el premio está abierto.
- Código visible sin QR.
- Formato de prueba: `EXCLU-11SEP-######`, sin repetir dentro de la sesión de pruebas.
- En producción se muestra el `reward_code` devuelto por Supabase.
- Incluye `supabase/migrations/006_reward_code_exclu_format.sql` con generador único de códigos `EXCLU-fecha-número`.
- Home y Hub no se han modificado visualmente.

## 053 · Popup premio igual al boceto aprobado
- Popup de premio compactado y colocado sobre la ruleta como en el boceto aprobado.
- Confeti dorado animado con piezas y serpentinas.
- Código visible sin QR, formato `EXCLU-FECHA-NÚMERO`.
- No se modifica Home ni Hub.

## 055 · Popup aprobado + premio según sector real
- Home y Hub sin cambios.
- El premio de prueba se calcula desde el ángulo final real y coincide con el icono bajo el puntero.
- Orden de sectores sincronizado con la rueda aprobada: regalo, ticket, estrella y café.
- Popup más pequeño y colocado como el boceto aprobado.
- Confeti dorado más ligero, con piezas y serpentinas animadas detrás del popup.

## 056 · Popup ruleta según boceto aprobado
- Solo cambia la pantalla de Ruleta.
- Popup compacto según referencia aprobada.
- Confeti dorado visible y estático detrás del popup.
- Sonido/fanfarria de premio reforzado.
- Premio de preview usa exactamente el mismo índice del sector al que se dirige el giro.


## 067 · Ajuste final Ruleta
- Icono oficial en cabecera.
- Centro solo con icono oficial.
- Bombilla visible bajo el puntero.
- Home y Hub no se modifican.


## 068 · Popup premio
- Se sube el botón ¡GENIAL! para reducir el espacio con el código.


## 072 · Corrección definitiva ruleta/popup
- Sin luces CSS falsas: se muestran las dos bombillas reales del aro a ambos lados del puntero.
- Ajuste vertical mínimo de la rueda para alinear esas luces con el puntero.
- Popup aprobado compactado físicamente: eliminada la frase de entrega y subido el botón sin máscara negra.
- Home y Hub intactas.


## 073 · Centrado de la Ruleta
- El buje/logo fijo comparte exactamente el centro geométrico de la imagen que gira.
- No se modifican luces, popup, premios, Home ni Hub.


## 074 · Ajuste fino de logos
- Logo central desplazado ligeramente a la derecha.
- Logo superior centrado y ampliado para ocultar cualquier resto del logo antiguo.
- No se modifica la ruleta, el popup ni la lógica.


## 075 · Ajuste fino logos Ruleta
- Logo del centro desplazado un poco más a la derecha.
- Logo superior más pequeño y más arriba para no tapar el nombre La Exclusiva.
- No se modifica la ruleta, popup, luces ni lógica.


## 076 · Logos integrados y popup aprobado
- Logo superior integrado directamente en el fondo, sin overlay.
- Logo central integrado exactamente en el centro del PNG que gira.
- Popup sustituido por el boceto aprobado, manteniendo premio y código dinámicos.


## 077 · Ajuste visual Ruleta
- Logo superior desplazado ligeramente a la izquierda para alinearlo con La Exclusiva.
- Popup usa el boceto completo para conservar todo el borde dorado.
- Eliminado el doble marco/doble código: el código dinámico se centra sobre el marco original.
- No se modifica Home, Hub ni lógica de premios.


## 078 · Popup reconstruido
- Popup completamente reconstruido con HTML/CSS, sin usar imagen de fondo.
- Borde dorado completo.
- Un único código centrado en un único marco.
- Solo se modifica el popup de premio.


## 079 · Popup exacto aprobado
- Se usa directamente el boceto aprobado como base visual del popup.
- Solo premio y código son dinámicos.
- No se dibuja ninguna parte de la ruleta o fondo dentro del popup.
- Un único código, centrado en el marco dorado original.


## 080 · Popup final
- Base visual recortada exactamente al marco del boceto aprobado.
- No incluye ninguna parte de la ruleta/fondo exterior.
- Premio dinámico contenido dentro de la cinta.
- Un único código centrado dentro del marco dorado original.
- Solo se modifica el popup.


## 081 · Popup basado en la captura aprobada
- La base visual es la propia captura aprobada por el usuario.
- Se eliminan Editar/Compartir de la captura.
- Una sola cinta dorada.
- Un solo marco de código y código centrado.
- Borde dorado completo por los cuatro lados.
- Solo se modifica el popup.


## 082 · Popup corregido sin imágenes
- Popup reconstruido exclusivamente con HTML/CSS.
- Más pequeño y centrado sobre la ruleta.
- Borde dorado cerrado por los cuatro lados.
- Una sola cinta dorada.
- Un solo marco y código perfectamente centrado.
- No se modifica la ruleta ni otras pantallas.


## 083 · Volver al popup aprobado
- Se usa exactamente la captura del popup aprobada como base visual.
- No se crea un diseño nuevo.
- Una sola cinta, un solo marco de código y borde cerrado.
- Popup más pequeño y centrado sobre la ruleta.
- Solo premio y código son dinámicos.


## 084 · Popup corregido
- Una única cinta dorada real; se elimina el rectángulo amarillo interior.
- Borde dorado completo y continuo por los cuatro lados.
- Código centrado dentro del único marco.
- Popup más pequeño y centrado sobre la ruleta.
- Solo se modifica el popup.


## 085 · Texto del premio
- Se reduce únicamente el tamaño del nombre y descripción del premio para que se lean completos dentro de la cinta.


## 086 · Pasaporte funcional
- Home, segunda pantalla y Ruleta quedan congelados y no se modifican.
- 11/12/13 septiembre bloqueados hasta su fecha real (Europe/Madrid).
- Los sellos dependen exclusivamente de participaciones guardadas en Supabase.
- El día correspondiente se abre solo durante su fecha; días pasados sin participación quedan finalizados.
- Al completar los 3 días, el backend existente añade automáticamente +2 participaciones extra.
- Compatible con exclu_test_day únicamente cuando el festival está en modo pruebas.


## 087 · Fix pantalla negra Pasaporte
- Se corrigen dos iconos no importados que provocaban un ReferenceError al renderizar Passport.
- Home, segunda pantalla y Ruleta no se modifican.


## 088 · Rediseño visual Pasaporte
- Pasaporte centrado y mobile-first, acorde al diseño negro/dorado/cyan de EXCLU FEST.
- Se elimina la apariencia genérica de Card en la vista Pasaporte.
- Los tres días siguen siendo funcionales y bloqueados por fecha real Europe/Madrid.
- Los datos de pruebas previas no muestran el pasaporte como completado antes del 11 de septiembre.
- Home, segunda pantalla y Ruleta no se modifican.


## 089 · Ajustes Pasaporte
- Pasaporte centrado realmente en pantalla.
- Altavoz eliminado únicamente en la vista Pasaporte.
- Aviso de usuario registrado reducido al ancho del contenido móvil.
- Navegación inferior centrada al mismo ancho del Pasaporte.
- Home, segunda pantalla y Ruleta no se modifican.


## 090 · Pasaporte sin hueco vertical
- Eliminado min-height:92vh del screen-wrap únicamente en Pasaporte.
- Registro colocado inmediatamente debajo del Pasaporte.
- Navegación inferior integrada en el flujo, no fija, únicamente en Pasaporte.
- Ajuste para que Pasaporte + registro + navegación entren juntos en pantalla móvil cuando la altura lo permite.
- Home, segunda pantalla y Ruleta no se modifican.


## 091 · Fotomatón rediseñado
- Fotomatón centrado y mobile-first.
- Se reutiliza el EXCLU aprobado de la segunda pantalla.
- Cámara frontal, cuenta atrás, flash, marcos, filtros y stickers funcionales.
- Guardar, compartir y repetir foto funcionales.
- Contador de fotos sigue actualizándose en navegación.
- Home, segunda pantalla, Ruleta y Pasaporte no se modifican.


## 092 Fotomatón aprobado
Implementación funcional basada en el diseño aprobado: cámara, marcos, stickers, filtros, guardar, compartir y repetir. Sin cambios en Home, segunda pantalla, Ruleta ni Pasaporte.


## 093 · Fotomatón aprobado sin recortes
- Layout de tres columnas adaptado matemáticamente a 405 px.
- Sin overflow horizontal ni laterales cortados.
- Mantiene cámara, marcos, stickers, filtros, guardar, compartir y repetir.
- Home, segunda pantalla, Ruleta y Pasaporte no se modifican.


## 094 · Fotomatón fiel al diseño aprobado
- Reestructura el Fotomatón según la captura aprobada de 393px.
- Incluye 8 marcos visuales y 10 stickers seleccionables.
- Cámara, filtros, captura, guardar, compartir y repetir siguen funcionales.
- No modifica Home, segunda pantalla, Ruleta ni Pasaporte.


## 095 · Fotomatón 1:1 diseño aprobado
- Se usa directamente el diseño aprobado como interfaz visual.
- Cámara real superpuesta en el hueco exacto de la cámara del boceto.
- Marcos, stickers, filtros y botones funcionan mediante hotspots transparentes.
- Guardar, compartir, repetir y navegación siguen funcionales.
- No se modifican Home, segunda pantalla, Ruleta ni Pasaporte.


## 096 · Hotspots exactos Fotomatón
- Zonas táctiles recalculadas con coordenadas reales del PNG aprobado de 982x1602.
- Cada marco, sticker y filtro coincide con su botón visible.
- Añadidos filtros Vintage y Neón funcionales.
- Cámara central, Guardar, Compartir, Repetir y navegación reajustados.
- No se modifica el diseño visual ni Home, segunda pantalla, Ruleta o Pasaporte.


## 097 · Selección única Fotomatón
- Selfie Time y Fiestas 2026 ya son stickers funcionales.
- Solo un marco puede verse seleccionado a la vez.
- Solo un sticker puede verse seleccionado a la vez.
- Solo un filtro puede verse seleccionado a la vez.
- Se neutraliza el borde cyan fijo del PNG cuando el elemento no está seleccionado.
- No se modifica Home, segunda pantalla, Ruleta ni Pasaporte.


## 098 · Selección visual única
- Se enmascaran los halos cyan que vienen dibujados en el PNG aprobado.
- En Marcos solo el marco seleccionado queda iluminado en cyan.
- En Filtros solo el filtro seleccionado queda iluminado en cyan.
- No se cambia el diseño ni la lógica de selección.
- Home, segunda pantalla, Ruleta y Pasaporte permanecen intactos.


## 099 · Selección única real
- Clásico EXCLU queda seleccionado por defecto.
- Normal queda seleccionado por defecto.
- Al elegir otro marco, se oculta el halo/tick fijo de Clásico y solo se ilumina el nuevo.
- Al elegir otro filtro, se oculta el halo fijo de Normal y solo se ilumina el nuevo.
- No se modifica el diseño general ni otras pantallas.


## 100 · Clásico EXCLU sin tick
- Se elimina visualmente el tick fijo del primer marco.
- Clásico EXCLU queda con el mismo estilo base que los demás marcos.
- Clásico queda iluminado por defecto mediante el estado React.
- Al elegir otro marco, solo ese nuevo marco queda iluminado.
- Filtros y stickers no se modifican.


## 101 · Marco Clásico EXCLU neutro
- Se elimina directamente del PNG base el halo cyan fijo y el tick.
- Todos los marcos parten con borde dorado neutro.
- Solo el marco activo se ilumina en cyan.
- Filtros y stickers no se modifican.


## 102 · Clásico EXCLU igual al resto
- Se reconstruye completamente la tarjeta Clásico EXCLU en el PNG base.
- Se elimina definitivamente el tick, el triángulo cyan y el doble borde.
- Clásico usa la misma estructura visual que Fiesta, Selfie, Brindis, etc.
- Solo el marco activo se ilumina en cyan, incluido Clásico.
- Filtros y stickers no se modifican.


## 103 · Marco Clásico rehecho desde cero
- Se elimina físicamente del PNG toda la tarjeta antigua y su halo cyan.
- Se redibuja Clásico EXCLU con el mismo tipo de tarjeta que el resto.
- Sin tick, sin doble marco y sin luz residual.
- Solo el marco realmente activo se ilumina en cyan.
- No se modifica ninguna otra parte del Fotomatón ni otras pantallas.


## 104 · Clásico EXCLU aprobado
- Se incorpora el diseño aprobado por la usuaria para Clásico EXCLU.
- Sin tick.
- Cyan por defecto mientras Clásico está seleccionado.
- Al elegir otro marco, la selección cyan pasa al nuevo.
- No se modifican stickers, filtros ni otras pantallas.


## 105 · Clásico EXCLU igual que los demás
- Se borra por completo el marco Clásico anterior.
- Se usa una tarjeta existente del mismo panel como plantilla real.
- Sin tick, sin doble tarjeta y sin halo fijo.
- Clásico tiene el mismo tamaño y comportamiento visual que los demás marcos.
- Solo el marco seleccionado se ilumina en cyan.


## 106 · Logo real en Clásico EXCLU
- Se mantiene intacto el marco Clásico aprobado.
- Solo se sustituye el símbolo anterior por el logo real aportado por la usuaria.
- No se modifican bordes, texto, tamaños, selección, filtros, stickers ni otras pantallas.


## 107 · Marco Clásico definitivo
- Se usa directamente el diseño aprobado por la usuaria.
- Solo se sustituye el símbolo por el logo real proporcionado.
- Se elimina físicamente el marco anterior antes de insertar el nuevo.
- Sin tick, sin línea interior izquierda, sin punto blanco y sin doble tarjeta.
- La selección cyan funciona igual que en el resto de marcos.
- No se modifican stickers, filtros ni otras pantallas.


## 108 · Clásico EXCLU reemplazado exacto
- Se deja de editar la tarjeta incrustada en el PNG base.
- Se cubre completamente la tarjeta antigua.
- Se coloca encima el marco aprobado exacto con el logo real.
- Sin doble tarjeta, sin línea interior, sin punto blanco y sin tick.
- El cyan solo aparece cuando Clásico está realmente seleccionado.


## 112 · Fotomatón basado directamente en boceto aprobado
- El boceto aprobado se usa como superficie visual, evitando reinterpretaciones CSS.
- Marcos: 7 opciones, sin Personalizado.
- Primera opción activa por defecto en Marcos, Stickers y Filtros.
- Solo una selección iluminada por grupo.
- Cámara, cambio de cámara, captura, flash, guardar, compartir y repetir conectados.
- Resto de pantallas intactas.


## 113 · Selecciones alineadas
- Corregida la relación del boceto a 1024x1536 (2:3).
- Hotspots de Marcos, Stickers y Filtros fijados sobre cada opción real.
- Clásico EXCLU, primer sticker y Normal siguen siendo los valores por defecto.
- Solo una opción por grupo puede mostrar halo cyan.
- Cámara y controles reajustados a la geometría real del boceto.


## 114 · Hotspots exactos de Marcos
- Solo se corrigen las zonas pulsables de los 7 marcos.
- Cada hotspot coincide con la tarjeta visible del boceto aprobado.
- No se modifican Stickers, Filtros, cámara, botones ni otras pantallas.


## 115 · Cámara frontal/trasera funcional
- La cámara abre por defecto en modo frontal.
- Cambio frontal/trasera funcional con parada limpia del stream anterior.
- Fallback para navegadores que no respetan facingMode.
- Cámara frontal espejada y trasera sin espejo.
- El diseño visual y hotspots de Marcos no se modifican.

## 116 · Corrección de build Netlify
- Corregidos retornos de play(): ahora siempre devuelve GameResult | null.
- Tipos de Quiz y Boxes alineados con play().
- Restaurado el componente Prizes que faltaba.
- No se modifica el diseño aprobado del Fotomatón ni las pantallas congeladas.


## 117 · Cambio de cámara reversible
- Cambio frontal ↔ trasera sin ocultar los controles.
- Se solicita primero la cámara exacta y se usa fallback compatible.
- Si el cambio falla, se intenta recuperar la cámara anterior.
- No se modifica el diseño ni las pantallas congeladas.


## 118 · Cámara y controles siempre visibles
- Corregida la altura del vídeo: ya no tapa Cámara, Disparo ni Flash.
- Cambio frontal/trasera con una sola pulsación.
- Bloqueo temporal durante el cambio para evitar dobles pulsaciones.
- Si falla el cambio, recupera la cámara anterior sin ocultar controles.
- No se modifica el diseño aprobado ni las pantallas congeladas.


## 119 · Cámara sin reactivar entre cambios
- 'Activar cámara' solo aparece antes de la primera activación.
- Al cambiar frontal/trasera el vídeo permanece en la misma zona.
- No se vuelve a pedir activación visual en cada cambio.
- Cámara, disparo y flash permanecen visibles.
- No se modifica el diseño aprobado ni las pantallas congeladas.


## 120 · Foto igual a previsualización + pantalla completa
- La foto final conserva exactamente la proporción del visor.
- El recorte de captura replica object-fit: cover del vídeo.
- La cámara frontal conserva el espejo también en la foto final.
- El Fotomatón se limita por ancho y por altura del viewport móvil.
- No se modifican Home, Play Hub, Ruleta ni Pasaporte.


## 121 · Zoom solo en la cámara
- Pellizco con dos dedos únicamente sobre el visor de cámara.
- Rango de zoom 1x–3x.
- La foto final conserva el mismo zoom que se ve en pantalla.
- No cambia el zoom, scroll ni tamaño del resto de la app.
- No modifica las pantallas congeladas ni el diseño aprobado.
