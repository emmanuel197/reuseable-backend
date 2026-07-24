# Containerise day one -> migration-safe. Multi-stage build for apps/api.
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

# --- deps: install with the full workspace manifest set ---
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY packages/ ./packages/
COPY apps/ ./apps/
RUN pnpm install --frozen-lockfile

# --- build: compile packages then the api ---
FROM deps AS build
RUN pnpm -r build

# --- runtime ---
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app ./
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
