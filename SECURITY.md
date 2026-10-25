# Seguridad

No publiques bases de datos, cookies, contraseñas, enlaces privados vigentes ni variables de entorno en incidencias o capturas.

Si encuentras una vulnerabilidad, comunícala de forma privada al mantenedor del repositorio con pasos de reproducción sobre una instalación de prueba. Incluye la revisión afectada y el impacto, sin datos de otras personas.

Antes de desplegar, pasa `npm test`, `npm run build` y la auditoría de dependencias. Usa HTTPS, un origen público canónico correcto, SQLite en un volumen local persistente y copias consistentes de seguridad. Las reglas y los permisos se comprueban en el servidor; la validación visual del cliente no sustituye estas comprobaciones.

La existencia de pruebas no garantiza ausencia de vulnerabilidades ni capacidad ilimitada. Las incidencias de dependencias y runtimes deben revisarse periódicamente.
