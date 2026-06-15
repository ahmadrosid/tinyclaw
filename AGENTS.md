# tinyclaw — Agent Context

## What is this?

A multi-agent platform (monorepo). Each profile has a **soul** — a set of files that define the agent's identity, style, operating instructions, and continuity memory.

There's also an `apps/` directory for server, CLI, web UI, telegram, and whatsapp apps.

## Soul System (`packages/core/src/soul/`)

Each profile's soul lives at `~/.tinyclaw/profiles/{profileId}/` and can contain:

| File | Key | Purpose |
|---|---|---|
| `SOUL.md` | `soul` | Identity — who the agent is |
| `STYLE.md` | `style` | Voice and writing style |
| `SKILL.md` | `skill` | Operating instructions |
| `MEMORY.md` | `memory` | Cross-session continuity — facts/preferences |
| `examples/*.md` | `examples` | Calibration examples (good/bad outputs) |

### How MEMORY.md flows into the system prompt

1. **`update_profile_memory` tool** (`packages/core/src/tools/profile-memory.ts`) — writes facts to `<soul-dir>/MEMORY.md`, organized by date. Limited to 4096 bytes.
2. **`loadSoulStack()`** (`packages/core/src/soul/load.ts`) — reads MEMORY.md (and other soul files) from the profile's soul directory.
3. **`composeSoulSystemPrompt()`** (`packages/core/src/soul/compose.ts`) — injects MEMORY.md content into the system prompt as `# Continuity (MEMORY.md)` section.

So when an agent calls `update_profile_memory`, the recorded fact is loaded into the system prompt of every subsequent session for that profile.

### Other soul files

Same flow: they're loaded by `loadSoulStack` and injected by `composeSoulSystemPrompt`:
- `SOUL.md` → `# Identity (SOUL.md)`
- `STYLE.md` → `# Voice & Style (STYLE.md)`
- `SKILL.md` → `# Operating Instructions (SKILL.md)`

## Tools (`packages/core/src/tools/`)

- `update_profile_memory` — record facts/preferences for cross-session continuity
- `knowledge_base_search` — search uploaded documents
- `web_search` — web search
- `search_files`/`ripgrep` — file/content search

## Key packages

- `packages/core` — soul system, tools, contracts, types
- `packages/agent` — chat loop, prompt composition, history compaction
- `packages/db` — database layer
- `packages/client` — API client
- `packages/skills` — skill definitions
