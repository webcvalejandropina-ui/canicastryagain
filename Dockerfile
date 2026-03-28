FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV SQLITE_PATH=/app/data/game.db

# Identificación en Portainer / registries
LABEL org.opencontainers.image.title="Canicas Try Again"
LABEL org.opencontainers.image.description="Juego de canicas con Next.js y SQLite"

RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN mkdir -p /app/data && chown -R nextjs:nextjs /app
USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]
