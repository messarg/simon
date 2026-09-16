# Simon ships as one artifact: the SPA, the API and the shared money module from one repository
# (§22). Two images come out of this file — `runtime` (Express) and `web` (Nginx + the built SPA).

# ── Dependencies, including the native build of better-sqlite3 ────────────────
FROM node:22-bookworm AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
# `prisma generate` runs in postinstall and needs the schema.
COPY backend/prisma backend/prisma
COPY backend/prisma.config.ts backend/
RUN npm ci

# ── Build: the SPA, and the Prisma client the API imports as TypeScript ───────
FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build -w frontend && npx prisma generate --schema backend/prisma/schema.prisma

# ── The API. TypeScript is the runtime format: no transpile step, no dist ─────
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    SIMON_DATA_DIR=/var/simon/data \
    SIMON_BACKUP_DIR=/var/simon/backups \
    SIMON_KEY_DIR=/var/simon/keys \
    SIMON_PRINT_DIR=/var/simon/prints \
    SIMON_LOG_DIR=/var/simon/logs \
    HOST=0.0.0.0 \
    PORT=5000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages ./packages
COPY --from=build /app/backend ./backend
RUN mkdir -p /var/simon/data /var/simon/backups /var/simon/keys /var/simon/prints /var/simon/logs \
 && chown -R node:node /var/simon /app
USER node
EXPOSE 5000
# Migrations are applied on startup: the owner never runs a CLI (§15.4).
CMD ["node", "--experimental-strip-types", "backend/src/index.ts"]

# ── The SPA, served by Nginx over TLS, same origin as the API (§16.6) ─────────
FROM nginx:1.27-alpine AS web
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 443
