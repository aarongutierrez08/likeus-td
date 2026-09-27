# Server image: installs the workspace and runs the room server with tsx (no build step yet).
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/sim/package.json packages/sim/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
COPY tools/package.json tools/
RUN pnpm install --frozen-lockfile --prod --filter @td/server... --ignore-scripts

FROM base AS run
COPY tsconfig.base.json ./
COPY packages/sim packages/sim
COPY packages/server packages/server
ENV NODE_ENV=production
ENV PORT=2567
EXPOSE 2567
CMD ["pnpm", "--filter", "@td/server", "run", "start"]
