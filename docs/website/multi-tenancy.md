# Multi-tenancy

Each **organization** is a flat tenant boundary. Within an org, each profile has a **soul** — files that define the agent's identity, style, operating instructions, and continuity memory.

Organizations isolate tenant-owned data: profiles, sessions, automations, tasks, tools, MCP servers, skills, and usage stats. Each row carries an optional `org_id` column (see `packages/db/sql/schema.sql` and `migrateTenantOrgScope` in `packages/db/src/migrate.ts`).

## Actors and roles

| Actor | Scope | Capabilities |
|---|---|---|
| Platform admin | Deployment | Create/list orgs (`/v1/platform/orgs`), manage profiles/tools/MCP/skills |
| Org admin | One org | Invite/remove members, change roles (`/v1/orgs/{orgId}/members`) |
| Org member | One org | Chat, run agents, manage automations/tasks |
| Org viewer | One org | Read chat history only — blocked from agent invocation and mutations |

## Org context on requests

Every authenticated API call (except `/v1/auth/*` and `/v1/platform/*`) requires org context:

1. `X-Org-Id` request header (set by `@tinyclaw/client` and tests), or
2. `active_org_id` on the browser session cookie (set via `POST /v1/auth/active-org`).

Org middleware (`apps/server/src/http/org-middleware.ts`) verifies membership and attaches `orgRole` to the request auth context. Role guards live in `apps/server/src/http/org-guards.ts`.

## Onboarding flow

- Fresh install: `POST /v1/auth/setup` creates the first org, admin user, and browser session.
- Additional orgs: platform admin creates via `POST /v1/platform/orgs`.
- New members: org admin invites via `/v1/orgs/{orgId}/invites`; invitee accepts via `POST /v1/auth/accept-invite`.
- Multi-org users: web org switcher (`apps/web/src/components/OrgSwitcher.tsx`) or `client.setActiveOrg()`.

## Flat org-as-tenant model

First-time setup (`POST /v1/auth/setup`) creates the initial org and admin user. Platform admins provision additional orgs via `/v1/platform/orgs`. Org admins invite members through `/v1/orgs/{orgId}/members` and `/v1/orgs/{orgId}/invites`. Users with multiple org memberships switch via the web org switcher or `POST /v1/auth/active-org`. Shared channel bots (Telegram/WhatsApp) will route via `channel_org_mappings`; schema is in place.

## Where to make org-related changes

| What you want to change | File |
|---|---|
| Org context resolution, header name | `apps/server/src/http/org-middleware.ts` |
| Org CRUD, invites, member management | `apps/server/src/services/org-service.ts` |
| Platform org routes | `apps/server/src/http/routes/platform-orgs.ts` |
| Org member routes | `apps/server/src/http/routes/org-members.ts` |
| Auth setup, login, active-org switching | `apps/server/src/http/routes/auth.ts` |
| Role guard helpers | `apps/server/src/http/org-guards.ts` |
| Org types and DB adapter methods | `packages/db/src/types.ts`, `packages/db/src/adapters/sqlite.ts` |
| API contract types | `packages/core/src/contract.ts` |
| Client org header injection | `packages/client/src/client.ts` (`setOrgId`, `X-Org-Id`) |
| Web auth state and org switcher | `apps/web/src/context/auth-context.tsx`, `OrgSwitcher.tsx` |

## Route access summary

- **Platform-admin-only routes:** profiles, tools, MCP servers, skills (mutations). Org admins cannot create profiles — they use profiles provisioned by the platform admin.
- **Org-admin routes:** member list, invite, add, remove, role change under `/v1/orgs/{orgId}/…`.
- **Viewer restrictions:** `requireNotViewer` on worker control and agent-invocation paths.
