# Drop site gateway. Build from the repo root:
#   docker build -f apps/gateway/Dockerfile .
# migrations/ is not needed here — the gateway only reads.

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
ENV PNPM_HOME=/pnpm
WORKDIR /app

# ---- deps + build -------------------------------------------------------
FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/gateway/package.json apps/gateway/
COPY packages/core/package.json packages/core/
COPY packages/typescript-config/package.json packages/typescript-config/
RUN pnpm install --frozen-lockfile --filter gateway...

COPY packages/typescript-config packages/typescript-config
COPY packages/core packages/core
COPY apps/gateway apps/gateway
RUN pnpm --filter gateway build

# Drop the build-only dependencies; what is left is the runtime store.
# (`pnpm deploy` needs inject-workspace-packages or --legacy, and --legacy wants the
# whole workspace present, so pruning in place is the simpler thing that works here.)
RUN CI=true pnpm install --frozen-lockfile --filter gateway... --prod

# ---- runtime ------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app/apps/gateway
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/gateway/node_modules /app/apps/gateway/node_modules
COPY --from=build /app/apps/gateway/package.json /app/apps/gateway/package.json
COPY --from=build /app/apps/gateway/dist /app/apps/gateway/dist
USER node
EXPOSE 3001
CMD ["node", "dist/index.js"]
