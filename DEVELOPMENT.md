# Development

## Requirements

| Tool | Version | Purpose |
|------|---------|---------|
| [Bun](https://bun.sh) | 1.3+ | Runtime, package manager, and local dev |
| [Docker](https://docs.docker.com/get-docker/) | 20+ (optional) | Run the server or CLI in a container |

For local development you only need Bun. The Docker image bundles Bun and supports the HTTP server, web dashboard, and interactive CLI.

## Local setup

```bash
bun install
bun run dev:server   # server only
bun run dev:cli      # CLI (auto-starts server if needed)
```

See [README.md](./README.md) for first-run provider setup and CLI usage.

## Docker

The [Dockerfile](./Dockerfile) builds an image with the server, web dashboard, and CLI. SQLite uses Bun’s built-in driver (`bun:sqlite`); no extra native database packages are required.

The [docker-entrypoint.sh](./docker-entrypoint.sh) accepts `server` (default) or `cli`.

### Build

```bash
docker build -t tinyclaw .
```

### Run the server

```bash
docker run -d --name tinyclaw \
  -p 4310:4310 \
  -v tinyclaw-data:/app/data \
  -v tinyclaw-config:/root/.tinyclaw \
  tinyclaw
```

API keys are optional at container start. Pass `-e OPENAI_API_KEY=sk-...` or `-e ANTHROPIC_API_KEY=sk-...` when you prefer env-based config; otherwise configure from the web dashboard (**Settings**) or the CLI (below).

The server listens on `http://0.0.0.0:4310` inside the container. Map port `4310` to reach the API and web dashboard from the host (`http://localhost:4310`).

### Web dashboard

The built web UI is served from the same port as the API. Open `http://localhost:4310` after starting the container.

On first run with no API key, go to **Settings** in the sidebar to enter your provider API key and model. Config persists on the `tinyclaw-config` volume.

For local development without Docker, run the Vite dev server separately:

```bash
bun run dev:web   # http://127.0.0.1:5173 with API proxy to :4310
```

### Run the CLI

The CLI needs an interactive terminal (`-it`). On first run with no API key configured, it prompts for a provider and API key, saves to `/root/.tinyclaw/config.ini`, and continues to chat. It auto-starts the server in the same container when nothing is listening on `TINYCLAW_SERVER_URL` (default `http://127.0.0.1:4310`).

```bash
docker run -it --rm \
  -v tinyclaw-data:/app/data \
  -v tinyclaw-config:/root/.tinyclaw \
  tinyclaw cli
```

To use a server that is already running (on the host or in another container), set `TINYCLAW_SERVER_URL`:

```bash
docker run -it --rm \
  -e TINYCLAW_SERVER_URL=http://host.docker.internal:4310 \
  tinyclaw cli
```

On Linux without `host.docker.internal`, use the host gateway IP or run both services via Compose (below).

### Docker Compose

[docker-compose.yml](./docker-compose.yml) runs the server in the background and attaches an interactive CLI that connects over the internal network:

```bash
docker compose run --rm cli
```

On first run, the CLI prompts for an API key and model. Config is saved to the `tinyclaw-config` volume and reused on later runs.

Start only the server (includes the web dashboard):

```bash
docker compose up -d server
```

Open `http://localhost:4310` and use **Settings** to configure the provider, or run the CLI:

```bash
docker compose run --rm cli
```

Provider credentials can come from three places (highest priority first):

1. Environment variables (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`) when explicitly set at runtime
2. `config.ini` on the `/root/.tinyclaw` volume (written from the web **Settings** page, CLI setup prompt, or server first-run setup)
3. Offline mode if neither is configured — the server still starts; configure via the dashboard or CLI

### Volumes

| Mount | Purpose |
|-------|---------|
| `/app/data` | SQLite database (`data/sqlite/tinyclaw.sqlite`), automations, logs |
| `/root/.tinyclaw` | User config (`config.ini`) and runtime files; persists provider credentials from CLI setup |

Persist at least `/app/data` so profiles, tools, and sessions survive container restarts.

### Health check

The image defines a `HEALTHCHECK` against `GET /health`. Inspect status with:

```bash
docker inspect --format='{{.State.Health.Status}}' tinyclaw
```

### Useful commands

```bash
docker logs -f tinyclaw
docker stop tinyclaw && docker rm tinyclaw
curl http://127.0.0.1:4310/health
```

Point a local CLI at a containerized server with `TINYCLAW_SERVER_URL=http://127.0.0.1:4310` before `bun run dev:cli`.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `TINYCLAW_HOST` | Server bind address (default `127.0.0.1`; Docker sets `0.0.0.0`) |
| `TINYCLAW_PORT` | Server port (default `4310`) |
| `TINYCLAW_SERVER_URL` | Client server URL override |
| `TINYCLAW_MODEL` | Model ID override |
| `OPENAI_API_KEY` | OpenAI API key (optional; overrides `config.ini` when set) |
| `ANTHROPIC_API_KEY` | Anthropic API key (optional; overrides `config.ini` when set) |
| `DATABASE_URL` | SQLite path (default `file:data/sqlite/tinyclaw.sqlite`) |

## Available models

| ID | Name | Provider |
|----|------|----------|
| `claude-sonnet-4-6` | Sonnet 4.6 | anthropic |
| `claude-opus-4-6` | Opus 4.6 | anthropic |
| `gpt-5.5` | GPT-5.5 | openai |
| `gpt-5.4` | GPT-5.4 | openai (default) |
| `gpt-5.3-codex` | GPT-5.3 Codex | openai |

## Dev scripts

| Script | Description |
|--------|-------------|
| `bun run dev:server` | Start the central server |
| `bun run dev:cli` | Start the CLI (auto-starts server if needed) |
| `bun run dev:docs` | Scalar API reference at `http://127.0.0.1:4320` |
| `bun run openapi:generate` | Regenerate `apps/server/openapi.json` from TypeScript |
| `bun run build` | Build all workspaces |

SQLite schema lives in `packages/db/sql/schema.sql` and is applied automatically on server startup (`CREATE TABLE IF NOT EXISTS`).
