FROM node:20-slim AS builder

WORKDIR /app

RUN npm install -g pnpm@10

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY lib/db/package.json ./lib/db/
COPY lib/integrations-gemini-ai/package.json ./lib/integrations-gemini-ai/
COPY lib/api-zod/package.json ./lib/api-zod/

RUN pnpm install --frozen-lockfile

COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/

RUN pnpm --filter @workspace/api-server run build

FROM node:20-slim AS runner

WORKDIR /app

RUN npm install -g pnpm@10

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY lib/db/package.json ./lib/db/
COPY lib/integrations-gemini-ai/package.json ./lib/integrations-gemini-ai/
COPY lib/api-zod/package.json ./lib/api-zod/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/artifacts/api-server/dist ./artifacts/api-server/dist

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "artifacts/api-server/dist/index.cjs"]
