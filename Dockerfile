# ═══════════════════════════════════════════════════════════════════════
# Harbour Visit Logger — Single-container multi-stage build
# Backend serves API + WebSocket + frontend static files on one port.
# ═══════════════════════════════════════════════════════════════════════

# Stage 1: Install all dependencies
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY backend/package.json ./backend/
COPY backend/prisma/schema.prisma ./backend/prisma/
COPY frontend/package.json ./frontend/

RUN npm ci

# Stage 2: Build everything
FROM node:22-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_module[s] ./packages/shared/node_modules/

COPY package.json ./
COPY packages/shared/ ./packages/shared/
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# 1. Build shared types
RUN npm run build -w @vessel/shared

# 2. Build frontend (Vite → static files)
RUN npm run build -w frontend

# 3. Generate Prisma client + build backend
RUN cd backend && npx prisma generate && cd ..
RUN npm run build -w backend

# Stage 3: Production runtime
FROM node:22-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 app && \
    adduser --system --uid 1001 app

# Copy only what's needed at runtime
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/package.json ./backend/
COPY --from=build /app/backend/node_module[s] ./backend/node_modules/
COPY --from=build /app/backend/prisma ./backend/prisma
COPY --from=build /app/backend/prisma.config.ts ./backend/
COPY --from=build /app/frontend/dist ./frontend/dist
COPY --from=build /app/package.json ./

# Entrypoint: migrate DB, seed, then start
COPY <<'EOF' /app/entrypoint.sh
#!/bin/sh
set -e
cd /app/backend
npx prisma db push --accept-data-loss
cd /app
exec node backend/dist/index.js
EOF
RUN chmod +x /app/entrypoint.sh

RUN mkdir -p /app/backend/prisma /app/data && chown -R app:app /app/backend/prisma /app/data

USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
