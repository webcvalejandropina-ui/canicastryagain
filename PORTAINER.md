# Desplegar en Portainer

Toda la configuración (puertos, variables de entorno, volúmenes) se hace desde Portainer.

## 1. Construir la imagen

Desde la raíz del proyecto:

```bash
docker build -t canicas-try-again:latest .
```

Si usas un registro (Docker Hub, GHCR, etc.):

```bash
docker build -t tu-registro/canicas-try-again:latest .
docker push tu-registro/canicas-try-again:latest
```

## 2. En Portainer

### Opción A: Imagen ya construida

1. **Contenedores** → **+ Añadir contenedor**
2. **Imagen**: `canicas-try-again:latest` (o `tu-registro/canicas-try-again:latest` si la subiste a un registro).
3. **Puertos**: publicar `3000` (ej. `3000:3000`).
4. **Variables de entorno** (opcional, tienen valores por defecto):
   - `NODE_ENV` = `production`
   - `PORT` = `3000`
   - `SQLITE_PATH` = `/app/data/game.db`
   - `PUBLIC_ORIGIN` = el origen HTTPS público de tu instalación, cuando esté publicada.
5. **Volúmenes**: mapear un volumen o bind a `/app/data` para persistir la base SQLite.
6. Crear el contenedor.

### Opción B: Stack (recomendado)

1. **Stacks** → **+ Añadir stack**.
2. Nombre: por ejemplo `canicas`.
3. En **Web editor** pega el contenido de `docker-compose.portainer.yml`.
4. Si la imagen está en un registro, cambia `image: canicas-try-again:latest` por tu imagen (ej. `tu-registro/canicas-try-again:latest`).
5. Ajusta puerto, env o volumen si quieres (todo desde Portainer).
6. **Deploy the stack**.

## Variables de entorno

| Variable       | Por defecto           | Descripción                    |
|----------------|------------------------|--------------------------------|
| `NODE_ENV`     | `production`           | Entorno Node                   |
| `PORT`         | `3000`                 | Puerto interno del contenedor  |
| `SQLITE_PATH`  | `/app/data/game.db`    | Ruta del archivo SQLite        |
| `PUBLIC_ORIGIN` | Vacío en local | Origen HTTPS público; configúralo tras el proxy. |
| `GAME_STREAM_LIMIT` | `1000` | Límite SSE por proceso, con alternativa HTTP. |

El directorio `/app/data` debe ser un volumen persistente para no perder partidas ni ranking.

No hay un usuario ni una contraseña de administrador predeterminados. Las cuentas se crean en cada instalación; el rol de administración debe concederlo el responsable desde el servidor. Un alias en variables de entorno no concede permisos.

Las claves y los datos reales pertenecen al servidor o al gestor privado de configuración de Portainer, nunca a un archivo publicado en GitHub. La clave de firma se genera automáticamente y se conserva en SQLite; normalmente no necesitas configurarla. Consulta la [guía de instalación](docs/INSTALACION.md).
