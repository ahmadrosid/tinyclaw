# Getting Started

Requires [Bun](https://bun.sh).

## Local development

```bash
# Install dependencies
bun install

# Start the web (starts the server automatically if needed)
bun run dev:web
```

Visit the web dashboard at `http://localhost:3000`

Or run the server on its own:

```bash
bun run dev:server
```

On first run, the server prompts for a provider and API key if none is configured. Settings are saved to `~/.tinyclaw/config.ini`.

The server listens on `http://127.0.0.1:4310` by default. Interactive API docs are available at `http://127.0.0.1:4310/docs`.

## Docker

You can also run TinyClaw with Docker.

**Prebuilt image (quickest):**

```bash
# Pull and run the latest image
docker pull ghcr.io/ahmadrosid/tinyclaw:latest
docker run -d -p 4310:4310 -v tinyclaw-config:/root/.tinyclaw ghcr.io/ahmadrosid/tinyclaw:latest
```

**Build from source:**

```bash
# Build the image
docker build --platform=linux/amd64 -t tinyclaw .

# Run the container
docker run -d -p 4310:4310 -v tinyclaw-config:/root/.tinyclaw tinyclaw
```

The dashboard will be available at `http://localhost:4310`.

## Integrations

TinyClaw integrates with **Telegram** and **WhatsApp**. Enable them in the web app under **Settings → Telegram** or **Settings → WhatsApp**.

## Next steps

- [Overview](/overview) — what TinyClaw is and how it is structured
- [Architecture](/architecture) — system diagram, codemap, and request lifecycle
- [Multi-tenancy](/multi-tenancy) — orgs, roles, and onboarding
