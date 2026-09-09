# Drop control app (web UI + REST API). Build from the repo root:
#   docker build -f apps/web/Dockerfile .
# The same image runs the cleanup job (docker-compose `drop-cleanup`).

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
ENV PNPM_HOME=/pnpm
WORKDIR /app

# ---- deps + build -------------------------------------------------------
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/ui/package.json packages/ui/
COPY packages/typescript-config/package.json packages/typescript-config/
COPY packages/eslint-config/package.json packages/eslint-config/
RUN CI=true pnpm install --frozen-lockfile --filter web...

COPY packages/typescript-config packages/typescript-config
COPY packages/eslint-config packages/eslint-config
COPY packages/ui packages/ui
COPY packages/core packages/core
COPY migrations migrations
COPY apps/web apps/web
# The build reads nothing from the database; env comes from the container at runtime.
RUN pnpm --filter web build

# ---- runtime ------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app /app
EXPOSE 3000
CMD ["pnpm", "--filter", "web", "start"]
