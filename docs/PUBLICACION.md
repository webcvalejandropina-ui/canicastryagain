# Publicación en GitHub

El código, recursos originales, documentación y vídeo se versionan. No se incluyen bases SQLite, sesiones, variables privadas, compilaciones `.next*`, archivos ZIP del ordenador ni capturas/logs de QA fuera de los ejemplos seleccionados para la documentación.

El repositorio de publicación es [webcvalejandropina-ui/canicastryagain](https://github.com/webcvalejandropina-ui/canicastryagain), de visibilidad pública. Solo se publica código y material seleccionado: nunca la base de datos ni la configuración privada de una instalación.

La [guía de instalación desde cero](INSTALACION.md) explica cómo levantarlo sin credenciales del autor y cómo mantener la configuración privada fuera del código.

## Protecciones del repositorio

Se verificaron la detección de secretos y la protección de subidas de GitHub, ambas activas. Las alertas de vulnerabilidades de dependencias están activadas. Estas protecciones complementan las pruebas locales; no sustituyen la revisión del código ni la configuración segura del servidor.

## Integración continua

La plantilla completa está en `scripts/ci-github-actions.yml`. Para activarla, un mantenedor puede copiarla a `.github/workflows/ci.yml` desde la web de GitHub o con una credencial autorizada para escribir workflows.

La credencial CLI comprobada en esta actualización permite escribir el repositorio, pero no tiene el permiso OAuth `workflow`. Por eso la carpeta local `.github/` permanece excluida y la plantilla queda versionada en `scripts/`. No se amplían permisos de la cuenta automáticamente ni se afirma que se haya ejecutado una Action remota sin comprobarlo.

La plantilla usa Node 22, permisos de lectura, cancelación de ejecuciones anteriores, instalación con lockfile, pruebas completas, build y auditoría de dependencias de producción.

## Vídeo

`docs/video/CANICAS_COMO_JUGAR_59s.mp4`: vertical, 1080 × 1920, 30 fps, H.264/AAC y 59 segundos. Incluye voz española, subtítulos integrados y SRT editable. Las escenas explicativas no son una partida continua. El lanzamiento del dado sí procede de una captura del juego.

Para reproducir localmente:

```sh
npm run video:preview
```

Abre `http://localhost:13008/VER_VIDEO.html`. El servidor soporta saltos por capítulos y peticiones Range. Para reconstruir:

```sh
npm run video:render
```

Requiere FFmpeg/ffprobe, Python 3, Node y Sharp (`CANICAS_SHARP_MODULE` permite indicar otra instalación). Instala las fuentes Archivo incluidas en `public/fonts/` para mantener la tipografía. La narración por escena ya está incluida, sin depender de una API o de macOS.
