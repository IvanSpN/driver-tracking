# Контекст сборки — корень репозитория (npm workspaces, общий package-lock.json)

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
RUN npm ci --workspace=apps/backend
COPY apps/backend apps/backend
RUN npm run build --workspace=apps/backend

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
RUN npm ci --workspace=apps/backend --omit=dev && npm cache clean --force

COPY --from=build /app/apps/backend/dist apps/backend/dist
COPY apps/backend/.sequelizerc apps/backend/
COPY apps/backend/src/database/config.js apps/backend/src/database/
COPY apps/backend/migrations apps/backend/migrations

WORKDIR /app/apps/backend
USER node
EXPOSE 3000
# Миграции при каждом старте: уже применённые sequelize-cli пропускает
CMD ["sh", "-c", "npx sequelize-cli db:migrate && exec node dist/main"]
