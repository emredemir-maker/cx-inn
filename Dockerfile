# ─── Build Stage ─────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

RUN npm install -g pnpm@10

# Copy workspace manifests first (better layer caching)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json tsconfig.json ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY lib/db/package.json ./lib/db/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/integrations-gemini-ai/package.json ./lib/integrations-gemini-ai/

RUN pnpm install --frozen-lockfile

# Copy source code (after install for cache efficiency)
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/

# Build: esbuild bundles workspace deps + allowlist into dist/index.cjs
RUN pnpm --filter @workspace/api-server run build

# ─── Runtime Stage ───────────────────────────────────────────────────────────
FROM node:20-slim AS runner

WORKDIR /app

RUN npm install -g pnpm@10

# Copy workspace manifests for prod dependency install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY lib/db/package.json ./lib/db/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/integrations-gemini-ai/package.json ./lib/integrations-gemini-ai/

# Install only production deps (workspace packages are already bundled in dist/)
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy the single bundled artifact from builder
COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "artifacts/api-server/dist/index.cjs"]
