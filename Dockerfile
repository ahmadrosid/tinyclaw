# TinyClaw — server, web dashboard, and CLI
# Build:  docker build -t tinyclaw .
# Server: docker run -d -p 4310:4310 tinyclaw          # API + dashboard at http://localhost:4310
# CLI:    docker run -it --rm tinyclaw cli             # prompts for API key on first run

FROM oven/bun:1.3-debian AS install
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/server/package.json apps/server/
COPY apps/cli/package.json apps/cli/
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/agent/package.json packages/agent/
COPY packages/db/package.json packages/db/
COPY packages/client/package.json packages/client/

RUN bun install --frozen-lockfile

COPY apps/server apps/server
COPY apps/cli apps/cli
COPY apps/web apps/web
COPY packages packages
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN bun run --filter @tinyclaw/web build \
  && chmod +x /usr/local/bin/docker-entrypoint.sh \
  && mkdir -p data/sqlite data/automations data/logs

ENV NODE_ENV=production \
    TINYCLAW_HOST=0.0.0.0 \
    TINYCLAW_PORT=4310 \
    DATABASE_URL=file:data/sqlite/tinyclaw.sqlite

EXPOSE 4310

VOLUME ["/app/data", "/root/.tinyclaw"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:4310/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["server"]
