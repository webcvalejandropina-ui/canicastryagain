# Instalar Canicas Try Again desde cero

El repositorio público contiene el código completo de la aplicación, recursos gráficos, pruebas, configuración de despliegue, documentación, vídeo y [licencia de uso no comercial](../LICENSE). No necesitas credenciales del autor para instalarlo. Las cuentas, sesiones y claves de una instalación se crean y guardan en su propio servidor.

## Descargar el código

```sh
git clone https://github.com/webcvalejandropina-ui/canicastryagain.git
cd canicastryagain
```

Utiliza Node 22 o 24 y npm para la instalación sin Docker. Las dependencias exactas están fijadas en `package-lock.json`.

## Probar en tu ordenador

```sh
npm ci
cp .env.example .env.local
npm run dev
```

- Menú: http://localhost:13000
- Práctica contra el ordenador: http://localhost:13000/demo
- Ranking: http://localhost:13000/#ranking

`.env.example` solo contiene valores de configuración públicos o vacíos. `.env.local` queda excluido de Git; no lo añadas forzosamente al repositorio. Para que otro dispositivo de la red pueda abrir la web, utiliza `npm run dev:host` y la IP local del ordenador en vez de localhost.

La base local se crea automáticamente en `data/game.db`. No contiene cuentas precargadas ni necesita la base de datos del autor. Registra una cuenta propia desde el menú, o entra en la práctica sin registrarte.

## Producción sin Docker

Desde la raíz del proyecto:

```sh
npm ci
npm run build
npm start
```

El puerto por defecto es 3000. Un servicio de producción debe mantener el proceso en ejecución y proporcionarle sus variables de entorno. Configura:

- `PUBLIC_ORIGIN`: origen HTTPS completo de tu instalación, sin ruta, consulta ni fragmento.
- `SQLITE_PATH`: archivo en disco local persistente, fuera de los archivos reemplazados al actualizar.
- `PORT`: puerto interno, si necesitas cambiar el 3000.
- `GAME_STREAM_LIMIT`: límite de conexiones SSE por proceso; el ejemplo usa 1000 y existe alternativa HTTP. No representa una capacidad garantizada de usuarios.

Las migraciones de SQLite se ejecutan al iniciar la aplicación. El directorio que contiene la base debe ser escribible por el usuario del proceso. No publiques ese directorio mediante el proxy ni lo compartas entre servidores.

En producción usa HTTPS y el [ejemplo de proxy Nginx](../deploy/nginx.conf.example). El buffering debe estar desactivado para las conexiones SSE. La PWA y la práctica offline necesitan una primera visita con conexión y un origen seguro.

## Producción con Docker Compose

```sh
docker compose up --build -d
```

La aplicación queda en http://localhost:3000 y persiste los datos en el volumen `sqlite_data`. Puedes comprobar su estado con:

```sh
docker compose ps
docker compose logs --tail=100 app
```

Para una instalación pública, guarda la configuración real en una ruta **fuera del repositorio**, con permisos de lectura limitados al responsable del despliegue. Docker Compose permite cargarla así:

```sh
docker compose --env-file /ruta/privada/canicas.env up --build -d
```

`/ruta/privada/canicas.env` es una ruta orientativa: debes crear tu propio archivo y configurar el origen público de tu servidor. No se distribuye ese archivo ni una clave real en este proyecto. El volumen persistente también queda fuera del código publicado.

Consulta [Portainer](../PORTAINER.md) si administras los contenedores mediante su interfaz. No elimines los volúmenes al actualizar si quieres conservar cuentas, partidas y eventos.

## Cuentas, administración y claves

- **No hay contraseña universal ni administrador predeterminado.** Registra tus propias cuentas en tu instalación.
- Los permisos se comprueban en el servidor usando el rol guardado de la cuenta. El operador con acceso a la base privada puede conceder el rol `players.is_admin` a una cuenta registrada y verificada; no se concede por elegir un alias ni desde una variable pública. Realiza esa operación solo con acceso administrativo al servidor y sobre la cuenta correcta.
- La firma de enlaces antiguos utiliza una clave criptográfica aleatoria que se genera por instalación y se conserva en SQLite. No necesitas copiar una clave de GitHub ni del ordenador del autor.
- Si proporcionas `INVITE_TOKEN_SECRET`, utiliza al menos 32 bytes aleatorios y guárdala en el gestor privado del servicio. En Compose, la configuración estándar utiliza la clave persistida de SQLite; si decides pasar una clave externa, debes añadir expresamente la variable al entorno del contenedor desde tu configuración privada.
- Conserva las copias de SQLite en almacenamiento privado: además de datos del juego pueden contener sesiones y claves. Rotar la clave de firma invalida los enlaces firmados anteriores.
- Los datos sintéticos de las pruebas no son cuentas de producción y no se cargan al arrancar. Ejecuta fixtures y pruebas HTTP únicamente con bases desechables, siguiendo [Pruebas](PRUEBAS.md).

## Qué se publica y qué se queda fuera

| En GitHub | Solo en cada instalación |
| --- | --- |
| Código, migraciones y pruebas | Base de datos y archivos WAL/SHM |
| Licencia y avisos de terceros | Cuentas reales, hashes de contraseñas y sesiones |
| Plantilla `.env.example` sin credenciales | Configuración real y variables privadas |
| Recursos gráficos y vídeo explicativo | Claves, certificados privados y copias de seguridad |
| Dockerfiles y ejemplos de despliegue | Tokens de GitHub, registro de imágenes u otros servicios |

Git y el contexto de construcción Docker excluyen los formatos y carpetas privadas habituales. No uses `git add -f` para saltarte esas exclusiones. Si se publica una credencial por error, retirarla del archivo no basta: revócala o rótala y revisa el historial antes de volver a publicar.

## Comprobar y actualizar

```sh
npm test
npm run build
npm audit --audit-level=high
```

Algunas pruebas abren puertos locales y crean bases temporales. El chequeo Docker automatizado revisa configuración; para comprobar el contenedor debes construirlo y ejecutarlo con Docker disponible.

Antes de actualizar, crea una copia consistente de SQLite y guarda aparte la configuración del servicio. Descarga los cambios con `git pull --ff-only`, instala las dependencias y vuelve a compilar y arrancar; con Compose, reconstruye la imagen conservando el volumen. Comprueba `/api/health`, una partida de prueba y la reconexión antes de dar por terminada la actualización.

Consulta también [README](../README.md), [Arquitectura](ARQUITECTURA.md), [Seguridad](../SECURITY.md) y [Publicación](PUBLICACION.md).
