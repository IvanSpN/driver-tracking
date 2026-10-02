# Контекст сборки — корень репозитория (npm workspaces, общий package-lock.json)

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
RUN npm ci --workspace=apps/frontend

# package-lock.json собран на Windows, и npm не записал в него linux-бинарники
# rolldown и lightningcss (npm/cli#4828) — доставляем их той же версии вручную
RUN ARCH=$(node -p process.arch) \
 && RD=$(node -p "require('./apps/frontend/node_modules/rolldown/package.json').version") \
 && LC=$(node -p "require('./apps/frontend/node_modules/lightningcss/package.json').version") \
 && npm install --no-save --workspace=apps/frontend \
      "@rolldown/binding-linux-$ARCH-gnu@$RD" "lightningcss-linux-$ARCH-gnu@$LC"

COPY apps/frontend apps/frontend
# API на том же домене — Caddy проксирует /api на backend
ENV VITE_API_URL=/api
RUN npm run build --workspace=apps/frontend

FROM caddy:2-alpine
COPY apps/frontend/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/frontend/dist /srv
