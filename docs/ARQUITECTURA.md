# Escenarios y calendario

El lugar, el aspecto de canicas/dado y los detalles ambientales son ejes separados. No cambian reglas, tiradas ni mensajes de la partida.

## Elección del aspecto

1. «Conservar siempre mi escenario habitual» desactiva eventos y sustituciones del administrador.
2. Una elección manual de ambiente tiene prioridad sobre Automático.
3. En Automático, cumpleaños de una cuenta autenticada con fecha guardada, durante tres días (víspera, día y posterior).
4. Sorpresa personal activa del administrador, si se permiten personalizaciones.
5. Sustitución del club, si se permiten personalizaciones.
6. Evento local/global activo por prioridad, especificidad de localidad e identificador estable.
7. Escenario habitual: La Línea y Gibraltar por defecto. Cádiz, Tarifa y Naturaleza son alternativas explícitas, sin cambios aleatorios durante la partida.

«Solo calendario» omite sorpresas personales y sustituciones del club. Un fondo subido tiene prioridad sobre la imagen del escenario; los detalles del evento pueden conservarse con `world: inherit`. Sin fondo subido, un escenario elegido sustituye la foto y conserva los materiales del ambiente. Navidad, Halloween y cumpleaños usan sus propias imágenes; verano usa Tarifa. Semana Santa tiene un escenario propio y recurrencia `easter`, días relativos al Domingo de Pascua (-7…0 por defecto). Todas las fechas se resuelven en Europe/Madrid.

## Ampliar

- Nuevo lugar incluido en el producto: añadir entrada con `source`, nombre y descripción en `src/features/appearance/sceneries.ts`, colocar el PNG en `artwork/worlds`, ejecutar `assets:sceneries` con Sharp disponible. Manifiesto WebP con hashes y versiones de 640/1280px. No tocar el tablero ni la red del juego.
- Sin desplegar código: el administrador puede subir una foto y asignarla al club, una fiesta o una persona. Biblioteca existente con permisos, límites de bytes/dimensiones, IDs inmutables y validación.
- Nuevo evento: editor del administrador, localidad opcional, prioridad y fechas anuales, edición con año, siempre o relativo a Pascua. Elegir ambiente, escenario, imagen y clima independientemente.
- Las migraciones insertan Semana Santa una sola vez. No sobrescriben configuraciones ni fiestas editadas/borradas por el administrador.

## Coste y conectividad

Dos capas de parallax CSS. Durante la partida solo se dibuja el escenario elegido; la PWA prepara el catálogo vigente una vez para la práctica offline, excluyendo hashes obsoletos; WebP estático con hash y caché inmutable. Se reutiliza la misma foto al cambiar entre claro/oscuro. El servidor no genera imágenes ni calcula animación. Movimiento reducido, pestañas ocultas y fondos fuera de pantalla detienen las animaciones.

El catálogo de apariencia tiene ETag y caché; las asignaciones personales no se cachean públicamente. Se consulta cada 5–5,5 minutos con dispersión, nunca por fotograma ni por jugada. Tiempo de espera de 8 segundos, cancelación de peticiones anteriores y protección frente a respuestas antiguas al cambiar identidad. Al volver la conexión se reintenta; sin red se conserva el último calendario válido (catálogo inicial si todavía no se descargó ninguno).

La sincronización de las partidas conserva SSE con deltas, revisiones, rechazo de comandos antiguos, capacidad acotada y recuperación de conexiones. Las pruebas de carga son locales: no garantizan capacidad ni latencia en cualquier servidor remoto.

## Capas de la aplicación

`src/backend/game/domain` define reglas, poderes y física. Los casos de uso validan cada acción y la infraestructura persiste en SQLite. Las rutas HTTP autentican al actor mediante cookies HttpOnly; un identificador enviado en JSON no concede acceso. El cliente se organiza por funcionalidades y aplica snapshots/deltas con revisiones para evitar retrocesos o dobles jugadas.

La sesión de registro y el perfil privado recuperan el cumpleaños; la fecha local antigua no es una fuente de identidad. Solo se guarda MM-DD. La celebración utiliza el calendario civil de Madrid y nunca modifica las reglas ni las probabilidades del dado.

## Cristal habitual y materiales de eventos

La canica general usa celeste y blanco, inspirados en La Línea. `artwork/glass/marble-linea.png` genera el WebP habitual y los iconos de marca; `marble-source.png` conserva el material base de los eventos. El manifiesto `glassAssets.json` separa `crystal` y `eventCrystal`: logo y satélite usan siempre el habitual, mientras que tablero, tirada antigua y dado pueden adoptar el material estacional. La vista general y la exploración 3D comparten la paleta habitual. Las áreas de interacción y los colores que identifican a cada jugador no cambian.

`npm run assets:glass` codifica los dos materiales (menos de 16 KB cada uno); `node scripts/generate-brand-assets.mjs` actualiza favicon, iconos instalables y vista previa para compartir. No hay procesamiento de imágenes durante la partida.
