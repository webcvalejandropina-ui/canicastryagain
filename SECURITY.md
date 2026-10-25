# Seguridad

No publiques bases de datos, cookies, contraseñas, enlaces privados vigentes ni variables de entorno en incidencias o capturas.

Si encuentras una vulnerabilidad, comunícala de forma privada al mantenedor del repositorio con pasos de reproducción sobre una instalación de prueba. Incluye la revisión afectada y el impacto, sin datos de otras personas.

Antes de desplegar, pasa `npm test`, `npm run build` y la auditoría de dependencias. Usa HTTPS, un origen público canónico correcto, SQLite en un volumen local persistente y copias consistentes de seguridad. Las reglas y los permisos se comprueban en el servidor; la validación visual del cliente no sustituye estas comprobaciones.

La existencia de pruebas no garantiza ausencia de vulnerabilidades ni capacidad ilimitada. Las incidencias de dependencias y runtimes deben revisarse periódicamente.

## Claves de invitación

Las firmas de enlaces antiguos utilizan una clave aleatoria propia de cada instalación, almacenada en SQLite, o `INVITE_TOKEN_SECRET` de al menos 32 bytes. No existe una clave pública predeterminada. Protege también las copias de la base: contienen claves y sesiones privadas. Cambiar la clave invalida los enlaces firmados anteriores; los enlaces privados opacos conservan su propio ciclo de vida. Al actualizar desde la clave predeterminada antigua, genera y comparte de nuevo los enlaces firmados.

El código es público en [canicastryagain](https://github.com/webcvalejandropina-ui/canicastryagain); los datos de la instalación no deben publicarse allí. Utiliza un gestor de secretos o las variables privadas de tu despliegue para claves configuradas explícitamente.
