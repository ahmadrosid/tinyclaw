# Development

## Dev commands

- **Runtime:** Bun 1.3+. Use `bun install`, `bun run`, `bun test`.
- **Dev servers:** `bun run dev:server` (HTTP API), `bun run dev:web` (dashboard), `bun run dev:cli` (CLI).
- **Docs site:** `bun run dev:docs` (VitePress at `docs/website`).

There's an `apps/` directory for server, web UI, CLI, telegram, and whatsapp apps.

## Key packages

| Package | Purpose |
|---|---|
| `packages/core` | Soul system, tools, contracts, types |
| `packages/agent` | Chat loop, prompt composition, history compaction |
| `packages/db` | Database layer |
| `packages/client` | API client |
| `packages/skills` | Skill definitions |

## System prompt — where to make changes

The system prompt is built in three layers. Know which one to edit:

| What you want to change | File | Function |
|---|---|---|
| Static chat structure (identity, USER.md, tools, timezone, channel rules) | `packages/agent/src/chat-prompt.ts` | `buildChatSystemPrompt` |
| Soul/identity content (SOUL.md, STYLE.md, INSTRUCTIONS.md, MEMORY.md) | `packages/core/src/soul/compose.ts` | `composeSoulSystemPrompt` |
| Dynamic per-turn context (current date, etc.) | `packages/agent/src/chat.ts` | `generateReply` |

`generateReply` is the final dispatch point — it calls `provider.generateChat()` / `provider.streamChat()` with the assembled system prompt string.

## Soul system

Each profile's soul lives at `~/.tinyclaw/profiles/{profileId}/`:

| File | Purpose |
|---|---|
| `SOUL.md` | Identity |
| `STYLE.md` | Voice and writing style |
| `INSTRUCTIONS.md` | Operating instructions |
| `MEMORY.md` | Cross-session continuity (facts/preferences) |
| `examples/*.md` | Calibration examples |

Soul files are read by `loadSoulStack()` (`load.ts`) and injected by `composeSoulSystemPrompt()` (`compose.ts`).

## Tools

Built-in tools in `packages/core/src/tools/`:

- `update_profile_memory` — writes to MEMORY.md
- `knowledge_base_search` — search uploaded documents
- `web_search` — web search
- `email` — list, read, search, and send mail via deployment mailbox settings
- `search_files` / `ripgrep` — file/content search

## Server notes

- HTTP runtime lives in `apps/server/src/http/app.ts` and uses Hono.
- Middleware order: auth (`auth-middleware.ts`) → org context (`org-middleware.ts`) → routes.
- Routes live in `apps/server/src/http/routes/*`.
- Auth and CSRF checks live in `apps/server/src/http/auth-middleware.ts` with helpers in `shared.ts`.
- OpenAPI is generated from the Hono route registration in `apps/server/src/http/openapi.ts`.
- `/openapi.json` is served dynamically from the Hono app; route registration is the source of truth.

## Docs site

The VitePress docs live in `docs/website/`. To work on them:

```bash
bun run dev:docs      # local dev server
bun run build:docs    # production build
bun run preview:docs  # preview production build
```

Content is migrated from root `README.md`, `ARCHITECTURE.md`, and `AGENTS.md`. Update both the source files and the VitePress pages when architecture changes.
