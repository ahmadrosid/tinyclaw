# Overview

TinyClaw is a multi-tenant AI assistant platform: one agent runtime, multiple thin clients. Each **organization** is a flat tenant boundary — profiles, sessions, tools, and related data are scoped to an org. Users chat with configurable bots, draft automations, and (eventually) run them. Everything funnels through a single HTTP server; clients do not embed agent logic.

## Monorepo layout

```text
tinyclaw/
├── apps/
│   ├── web/                 # Dashboard (primary UI); org switcher, setup wizard
│   ├── cli/                 # Terminal client; auto-starts server
│   ├── platform/
│   │   └── telegram/        # Telegram bot bridge; auto-starts server
│   │   └── whatsapp/        # WhatsApp bot bridge; auto-starts server
│   └── server/              # HTTP API, agent runtime, LLM providers
├── packages/
│   ├── core/                # Config, API types, provider interfaces, builtin tools
│   ├── agent/               # Chat harness, tool loop, automation engine
│   ├── db/                  # SQLite via bun:sqlite
│   └── client/              # HTTP SDK for apps
```

**Dependency rule:** `packages/*` never import from `apps/*`. Shared code flows packages → apps only.

## Architectural invariants

**One agent runtime.** Chat and automation drafting run only in `apps/server`. No client talks to OpenAI or Anthropic directly.

**Hub and spoke.** New channels are thin apps on `@tinyclaw/client`. There is no second agent implementation per channel.

**Packages do not depend on apps.** `packages/*` must not import from `apps/*`. Shared code flows packages → apps, never the reverse.

**Hono owns the HTTP surface.** The server entrypoint builds a single `OpenAPIHono` app in `apps/server/src/http/app.ts`. Runtime, tests, auth, and OpenAPI all go through that same app.

**Providers are server-only.** OpenAI and Anthropic adapters live under `apps/server/src/providers/`, not in `@tinyclaw/core` or `@tinyclaw/agent`.

**Organizations gate tenancy.** Each deployment hosts many orgs. Authenticated requests (except `/v1/auth/*` and `/v1/platform/*`) must carry org context via the `X-Org-Id` header or the browser session's `active_org_id`. Middleware verifies org membership and attaches `orgRole` before route handlers run.

**Profiles gate behavior.** A session binds to a profile (`default` when omitted). The profile supplies the system prompt and tool allowlist before any message is handled. Profile, tool, MCP, and skill admin routes require **platform admin**; org admins manage members only.

**Org roles.** Three org roles: `admin`, `member`, `viewer`. Viewers may read chat history but cannot invoke agents or mutate state (`requireNotViewer`). Platform admins manage org lifecycle but do not access org data unless they are also org members.

**Chat history is in-memory.** `AgentChatSession` holds `ChatMessage[]` in the server process. SQLite stores orgs, profiles, tools, session metadata — not message bodies. Tenant-owned tables carry an `org_id` column for per-org isolation.

**Tools are allowlisted per profile.** The model may only invoke tools assigned to the active profile. Super Bot gets extra runtime tools (meta-tools, `bash`) injected server-side for `super_bot`.

**Tool calls use native LLM function calling.** Allowed tools are sent to OpenAI or Anthropic as structured definitions with JSON Schema parameters. The model returns tool calls; the server executes handlers and feeds results back as tool messages. Streaming clients receive `tool_start` / `tool_end` SSE events during execution.

## Next steps

- [Architecture](/architecture) — full system diagram and codemap
- [Multi-tenancy](/multi-tenancy) — org model, roles, and onboarding
- [Builtin tools](/builtin-tools) — allowlisted tools, defaults, and availability
