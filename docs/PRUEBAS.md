# Verificación del proyecto

```sh
npm ci
npm test
npm run build
npm audit --omit=dev --audit-level=high
```

`npm test` ejecuta lint, sesiones/seguridad, PWA, inactividad, física, geometría y ocho poderes del dado, rivales, perfil/cumpleaños, reglas, 1–100 filas/zoom, aspecto, replay, demo, invitaciones privadas, deltas, conectividad, capacidad SSE, configuración Docker y smoke tests de producción/desarrollo.

Los smoke tests abren puertos locales y crean compilaciones y bases temporales. Nunca ejecutar los scripts de carga sobre la base de una instalación real.

## Resultados de la comprobación local

- 100 partidas completas de tres filas: 200 conexiones SSE, 600 jugadas, 20 reconexiones, cero errores. P95 de entrega: 234,25 ms; 24 tareas de cliente concurrentes.
- Dos procesos con la misma base SQLite local: tableros idénticos, entrega de revisión en 500,33 ms y comando repetido rechazado con HTTP 409.
- Son mediciones sintéticas de loopback en una máquina de desarrollo, no una certificación de capacidad remota, de una CPU concreta ni de todas las redes móviles.
- Fondo, tamaño y selección revisados en un Android temporal: jugada táctil confirmada en Firefox; revisión visual en Chrome y Samsung Internet. No sustituye una comprobación en todos los dispositivos físicos ni acredita FPS constantes en Safari.
- Cumpleaños: cuenta autenticada, registro, edición/borrado, recuperación en otra sesión, privacidad, CSRF, invitados, cierre de sesión, tres días, cambio de mes/año, DST y 29 de febrero. En el tablero se comprobaron 28 canicas vivas y 28 decoraciones.
- Recursos nuevos de escenario: máximo 46.384 bytes a 640px y 145.480 a 1280px; primer plano vectorial reutilizado. La PWA excluye 12 recursos visuales sustituidos de su precarga.

## HTTP y carga con datos desechables

Preparar una base con las migraciones del proyecto y levantar una instancia local que use esa base. Los scripts con cuentas fixture necesitan sus cuentas de prueba; consulta sus comentarios de cabecera. Los fixtures sintéticos de carga solo aceptan un archivo existente con nombre `*-qa.db` dentro de `/private/tmp`.

Ejemplo de carga, con un servidor de pruebas ya levantado:

```sh
QA_SQLITE_PATH=/private/tmp/canicas-load-qa.db \
LOAD_URL=http://127.0.0.1:13010 LOAD_GAMES=100 LOAD_CONCURRENCY=24 \
LOAD_DELTAS=1 node --import tsx scripts/load-connectivity.mjs
```

El script crea sesiones válidas para sus jugadores de prueba y las retira al terminar. No existe una ruta de autenticación especial ni se desactiva la seguridad para la carga.

El test entre procesos recibe `CONNECTIVITY_URL` y `CONNECTIVITY_OTHER_URL`, que deben usar la misma base temporal. `scripts/test-birthday-http.mjs` recibe `BIRTHDAY_QA_ORIGIN` y `QA_SQLITE_PATH`; crea sus propias cuentas de prueba y verifica que los cumpleaños no aparezcan en el catálogo público.

## Preparación de esta actualización

Se verificó también `npm ci` y `npm run build` sobre una exportación limpia de los archivos preparados para GitHub, sin `.env`, bases de datos ni tipos generados del ordenador. La auditoría de dependencias de producción indicó cero vulnerabilidades.

La configuración Docker supera su comprobación automatizada. La imagen no se ha construido ni ejecutado en esta revisión porque el daemon de Docker estaba apagado; esto no se presenta como una validación del contenedor en ejecución.

## Revisión de seguridad y publicación: 25 de octubre de 2026

- Clave de firma de invitaciones por instalación: generación criptográfica, persistencia privada, validación de la variable opcional y rechazo de firmas con la antigua clave pública. Prueba incluida en `test:security`.
- Superadas las comprobaciones de sesiones, roles de administración, CSRF, límites de petición, carreras entre procesos, invitaciones privadas y perfiles.
- Superadas las demás áreas de `npm test`; los smoke tests que abren puertos locales se repitieron con permiso de red local y pasaron en desarrollo y producción. Compilación de producción completada.
- `npm audit --omit=dev --audit-level=high`: cero vulnerabilidades conocidas en dependencias de producción en esta revisión.
- Revisión de archivos versionados: sin bases SQLite, archivos de entorno privados ni coincidencias con los patrones de claves privadas y tokens comprobados. No sustituye una auditoría independiente ni garantiza ausencia de vulnerabilidades.
