# Contribuir

Lee primero la licencia de uso no comercial y las reglas del README. Usa Node 22 o 24, instala con `npm ci` y conserva el lockfile.

Mantén las reglas de partida en el dominio, autentica las operaciones en el servidor y añade pruebas para cambios de reglas, persistencia o sincronización. Para cambios visuales comprueba selección táctil, contraste, movimiento reducido y tamaños móviles, sin desplazar el documento horizontalmente.

Antes de proponer cambios ejecuta `npm test` y `npm run build`. Utiliza bases de prueba desechables para scripts HTTP/carga; nunca versiones datos reales ni variables privadas.

Los nuevos escenarios se añaden al catálogo de lugares y se codifican antes del despliegue. Los eventos administrables pueden combinar lugares, materiales y clima sin modificar las reglas ni enviar animaciones por la red.
