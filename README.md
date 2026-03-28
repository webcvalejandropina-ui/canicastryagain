# Canicas Try Again (Next.js + SQLite + DDD)

Aplicación migrada a **Next.js (App Router)** con persistencia en **SQLite**, lista para Docker y organizada para escalar:

- Backend con enfoque **DDD** (`domain`, `application`, `infrastructure`)
- Frontend con enfoque **feature-based** (`features/game`, `features/lobby`, `features/ranking`, `features/session`)
- Persistencia local con SQLite para partidas y ranking

## Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- better-sqlite3
- Docker / Docker Compose

## Estructura principal

```txt
src/
  app/
    api/
      games/
      rankings/
  backend/
    game/
      domain/
      application/
      infrastructure/
    ranking/
      domain/
      application/
      infrastructure/
    shared/
      domain/
      infrastructure/
  features/
    game/
    lobby/
    ranking/
    session/
```

## Desarrollo local

1. Instalar dependencias:

```bash
npm install
```

2. Inicializar/verificar SQLite:

```bash
npm run db:migrate
```

3. Ejecutar en desarrollo:

```bash
npm run dev
```

Abrir: `http://localhost:3000`

4. Ejecutar guard de runtime (recomendado antes de subir cambios):

```bash
npm run test:runtime
```

Este guard:
- valida `next build` + `next start` en entorno limpio
- valida `next dev` en `distDir` aislado
- hace smoke tests sobre `/`, rutas 404 y enlace con `code/inv`
- falla si detecta errores en logs como `ENOENT`, `MODULE_NOT_FOUND`, chunks fallback `500` o errores de webpack runtime

Además, se ejecuta automáticamente en GitHub Actions con el workflow `Runtime Guard` en cada `push` y `pull_request`.

### Modo desarrollo sin despliegue (hot reload)

Cada cambio se refleja automáticamente, no necesitas volver a desplegar.

- Local:

```bash
npm run dev
```

- Docker (dev con hot reload y SQLite persistente):

```bash
npm run dev:docker
```

Para detener:

```bash
npm run dev:docker:down
```

### Probar desde fuera con URL pública

Si quieres abrir la app en móvil o fuera de tu red local, usa:

```bash
npm run dev:public
```

Este comando:
- levanta Next.js en `0.0.0.0:3000`
- abre un túnel público con `cloudflared` forzado a `HTTP/2`
- deja esa URL disponible para el botón `Invitar`, incluso si tú estás usando `http://localhost:3000`

Importante:
- para la prueba más estable, abre esa misma URL pública tanto en el ordenador como en el móvil
- mientras el proceso siga vivo, la URL pública seguirá activa; al cerrarlo, el enlace deja de funcionar
- requiere tener `cloudflared` instalado en la máquina

## Docker

### Imagen para Portainer

Para desplegar en **Portainer** (toda la configuración se hace desde Portainer):

```bash
npm run docker:build
```

Luego en Portainer: crea un contenedor (o stack) con la imagen `canicas-try-again:latest`, puerto `3000`, volumen en `/app/data` y las env que necesites. Detalle en **[PORTAINER.md](./PORTAINER.md)**.

### Levantar con Docker Compose

```bash
docker compose up --build
```

- App: `http://localhost:3000`
- La base SQLite se persiste en el volumen `sqlite_data`.

### Variables relevantes

- `SQLITE_PATH` (default en Docker: `/app/data/game.db`)
- `PORT` (default `3000`)

## API principal

- `POST /api/games` crea partida
- `POST /api/games/join` une jugador por código
- `GET /api/games/:gameId?playerId=...` obtiene estado
- `POST /api/games/:gameId/move` realiza jugada
- `GET /api/rankings` obtiene leaderboard

## Notas de arquitectura

- Dominio: reglas de juego (misère, filas bloqueadas, turnos)
- Aplicación: casos de uso (crear, unir, mover, consultar)
- Infraestructura: SQLite y rutas HTTP de Next
- Frontend: separado por features para facilitar crecimiento por módulos
