---
title: "feat: Add profile memory tool for agents"
type: feat
status: active
date: 2026-06-15
---

# Add Profile Memory Tool for Agents

## Summary

Add a core builtin tool (`update_profile_memory`) that lets the agent programmatically append structured facts to its active profile's `MEMORY.md`. The tool respects profile isolation (operates only within the profile's soul directory), enforces a total size limit to prevent context bloat, and follows the existing Markdown date-section format. MEMORY.md content is already injected into the system prompt at session start, so no read tool is needed.

---

## Problem Frame

Each tinyclaw profile has a local `MEMORY.md` file designed to store persistent facts and context across chat sessions. The file is loaded as part of the soul stack and injected into the agent's system prompt under `# Continuity (MEMORY.md)`. However, the agent has no tool to persist new information during a conversation — it can only observe what was written before the session started. This forces users to manually update `MEMORY.md` and prevents the agent from learning implicitly from feedback, preferences, or project updates mid-conversation.

---

## Requirements

- R1. Agent can programmatically append structured Markdown to the active profile's `MEMORY.md`
- R2. Tool strictly respects profile isolation — operates only within the active profile's soul directory (`~/.tinyclaw/profiles/{profileId}/`)
- R3. Tool enforces a total size limit on `MEMORY.md` (default 4 KB) to prevent unbounded system prompt bloat
- R4. Tool creates `MEMORY.md` if it doesn't exist, using the existing template format (`packages/core/src/soul/templates.ts`)
- R5. New entries are date-stamped and appended as Markdown bullets under a `## YYYY-MM-DD` section header
- R6. Tool is protected from accidental deletion (follows existing protected tool pattern in `packages/core/src/tools/protected.ts`)

---

## Scope Boundaries

- No read tool — MEMORY.md is already injected into every session's system prompt
- No merge/deduplication — simple append semantics (if today's section exists, add a bullet; if not, create the section)
- No web UI or API endpoint for memory management
- No changes to how MEMORY.md is loaded (`packages/core/src/soul/load.ts`) or composed into the prompt (`packages/core/src/soul/compose.ts`)
- No changes to the profile database schema
- No version history or conflict resolution for concurrent edits

---

## Context & Research

### Relevant Code and Patterns

- `packages/core/src/tools/builtin.ts` — existing builtin tool pattern (`ToolDefinition`, `run` function, input validation helpers)
- `packages/core/src/tools/builtin.test.ts` — test pattern: temp directories, `PROFILE_CONTEXT`, async assertions, `PathGuardError`
- `packages/core/src/tools/protected.ts` — `BUILTIN_TOOL_IDS` map and `PROTECTED_TOOL_IDS` set for tool identity/protection
- `packages/core/src/tools/paths.ts` — `guardFilePath` path safety (reuse for path resolution)
- `packages/core/src/soul/resolve.ts` — `getProfileSoulDir(profileId)` resolves the profile's soul directory
- `packages/core/src/soul/templates.ts` — `MEMORY_TEMPLATE` for initial file creation
- `packages/core/src/soul/save.ts` — `writeSoulFile()` utility (though tool logic needs read-modify-write, not just write)
- `packages/core/src/fs.ts` — `readTextIfExists`, `writePrivateTextFile` for filesystem I/O
- `packages/core/src/contract.ts` — `ToolContext` (includes `profileId`), `ToolDefinition` interface

### Design Rationale

The tool goes in `packages/core/src/tools/` as a separate file (following `search-files.ts`, `web-search.ts`, `knowledge-base-search.ts` conventions), not inline in `builtin.ts`. The size limit is a hard ceiling (reject writes that exceed it) rather than automatic pruning — this lets the agent decide how to handle the limit (summarize old entries, remove stale ones, etc.).

---

## Key Technical Decisions

- **Tool name:** `update_profile_memory` — descriptive and unambiguous
- **Location:** New file `packages/core/src/tools/profile-memory.ts` — follows the existing convention for builtin tool definitions
- **Size limit:** 4,096 bytes (4 KB) total for MEMORY.md — hard ceiling, checked on every write. Configurable via an exported constant so tests can override. At ~100–200 bytes per entry, this accommodates roughly 20–40 facts. When the limit is hit, the agent receives a clear error and should summarize or prune the oldest entries to free space. The limit can be tuned per deployment by changing the exported constant
- **Append strategy:** Read existing MEMORY.md, check for a `## YYYY-MM-DD` section matching today's date. If found, append a new `- {content}` bullet. If not, append a new section header + bullet. If file doesn't exist, create from template + today's section
- **Protection:** Registered in `BUILTIN_TOOL_IDS` and `PROTECTED_TOOL_IDS` — consistent with write_file, delete_file, etc.
- **No read tool:** The agent already sees MEMORY.md content at session start via `# Continuity (MEMORY.md)` in the system prompt, making a dedicated read tool redundant. This assumes the volume stays within ~4 KB — the full content is always visible to the agent, so no search/filter capability is needed. If memory grows significantly beyond this limit in the future, a search parameter on `update_profile_memory` or a standalone search tool could be added

---

## Implementation Units

### U1. Create and register `update_profile_memory` tool

**Goal:** Implement the tool definition, append logic, size limit enforcement, and registration in the builtin tool chain.

**Requirements:** R1, R2, R3, R4, R5, R6

**Dependencies:** None

**Files:**
- Create: `packages/core/src/tools/profile-memory.ts`
- Modify: `packages/core/src/tools/builtin.ts` (import tool and add to `builtinTools` array)
- Modify: `packages/core/src/tools/protected.ts` (add tool ID to `BUILTIN_TOOL_IDS`)

**Approach:**
- Define `MemoryAppendInput` interface with a `content: string` property
- Export `MEMORY_MAX_BYTES = 4096` as a configurable constant
- Implement `updateProfileMemoryTool: ToolDefinition` with:
  - `name: "update_profile_memory"`
  - `description` explaining it appends to the active profile's MEMORY.md
  - `parameters` schema requiring `content` (string, describing the fact to remember)
- Implement `runUpdateProfileMemory(input, context)` function:
  1. Resolve profile soul directory via `getProfileSoulDir(context.profileId)` — throw `"profileId is required."` if missing (same pattern as `write_file`)
  2. Read existing MEMORY.md via `readTextIfExists` from `packages/core/src/fs.ts`
  3. If file doesn't exist, start with the template header (`# Memory Log` through the `---` separator from `MEMORY_TEMPLATE`), then append `## YYYY-MM-DD\n\n- {input.content}`
  4. If file exists and already has a `## YYYY-MM-DD` section (today's date), add `- {input.content}` as a new bullet under it
  5. If file exists but no today section, append `\n## YYYY-MM-DD\n\n- {input.content}`
  6. Check total byte size (`Buffer.byteLength`) against `MEMORY_MAX_BYTES` — if exceeded, throw a descriptive error
  7. Write via `writePrivateTextFile` from `packages/core/src/fs.ts` (ensures 0600 permissions, creates parent dirs)
- Import and re-export from `packages/core/src/tools/index.ts` if one exists (check at implementation time)
- Register in `builtinTools` array in `builtin.ts`
- Add `update_profile_memory: "tool_update_profile_memory"` to `BUILTIN_TOOL_IDS` in `protected.ts`

**Patterns to follow:**
- `packages/core/src/tools/search-files.ts` — separate file exporting a `ToolDefinition` object
- `packages/core/src/tools/builtin.ts:66-110` — `writeFileTool` definition structure and `buildFileGuardOptions` for profile context resolution
- `packages/core/src/tools/builtin.ts:194-211` — `readRequiredString` / `readOptionalString` input validation helpers (reuse these since they're co-located; note they are private functions and must be exported first or duplicated)

**Test scenarios:**
- Appends a bullet under a new `## YYYY-MM-DD` section when MEMORY.md doesn't exist yet
- Appends a bullet under an existing today section when MEMORY.md already has one
- Creates MEMORY.md with proper template header when file doesn't exist
- Rejects content that would exceed `MEMORY_MAX_BYTES` total size
- Throws `"profileId is required."` when context has no profileId (same as write_file)
- Operates strictly within the profile's soul directory
- Rejects empty content string with a validation error

**Verification:**
- `bun test packages/core/src/tools/profile-memory.test.ts` passes
- `bun test packages/core/src/tools/builtin.test.ts` passes (no regressions)
- Existing `bun test` suite passes

---

### U2. Write tests

**Goal:** Cover all scenarios for the `update_profile_memory` tool.

**Requirements:** R1, R2, R3, R4, R5, R6

**Dependencies:** U1

**Files:**
- Create: `packages/core/src/tools/profile-memory.test.ts`

**Approach:**
- Follow the exact test pattern from `packages/core/src/tools/builtin.test.ts`:
  - `import { mkdtemp, rm } from "node:fs/promises"` for temp directory management
  - `import os from "node:os"` and `import path from "node:path"` for temp path creation
  - `import { afterEach, describe, expect, test } from "bun:test"`
  - Use `const PROFILE_CONTEXT = { profileId: "profile_test" }`
  - Set `TINYCLAW_CONFIG_DIR` to the temp dir so `getProfileSoulDir` resolves inside the test sandbox
  - Cleanup in `afterEach` — delete temp dir, restore env vars

**Test scenarios:**
- **Happy path:** Appends a bullet under a new `## YYYY-MM-DD` section when MEMORY.md doesn't exist yet
- **Happy path:** Appends a bullet under an existing today's section
- **Happy path:** Handles multiple appends in the same date section (multiple bullets under one section)
- **Edge case:** Creates MEMORY.md template header (from `MEMORY_TEMPLATE`) when file doesn't exist
- **Edge case:** Rejects content that would push total size over `MEMORY_MAX_BYTES`
- **Error path:** Throws when `profileId` is missing from context
- **Error path:** Throws when `content` is empty or missing (if required)
- **Security:** Verifies MEMORY.md is only written to the profile's soul directory (no path traversal, no escaping the soul dir)

**Verification:**
- `bun test packages/core/src/tools/profile-memory.test.ts` passes
- All existing tests still pass (`bun test packages/core/`)

---

## System-Wide Impact

- **Agent experience:** Agents gain the ability to persist facts, preferences, and context across sessions. The semantic contract is "append a structured fact" — the agent decides what is worth remembering. Recommended heuristics: persist user preferences, project decisions, feedback, and cross-session context; skip transient state, intermediate reasoning, one-shot instructions, and content already stored elsewhere (skills, knowledge base)
- **Profile isolation:** The tool resolves the profile directory from `context.profileId`, ensuring each profile's memory is independent. No cross-profile access
- **Context window:** The 4 KB default limit prevents unbounded growth. The agent receives an error if the limit is hit and can decide to summarize or prune old entries
- **Backward compatibility:** Existing MEMORY.md files remain readable and continue to be injected into system prompts. The new tool only adds to them

---

## Risks & Dependencies

- **Concurrent session writes:** Two sessions with the same profile could race on MEMORY.md writes. This is an existing concern for all profile file tools (`write_file`, `delete_file`). Mitigation: accept it as a known limitation — MEMORY.md is a conversation-level artifact, not a concurrent database
- **Size limit too low:** 4 KB might be too tight for profiles that accumulate many facts. Mitigation: the limit is a single exported constant (`MEMORY_MAX_BYTES`) that can be raised without changing logic

---

## Documentation / Operational Notes

No operational changes. The feature is entirely additive — no migration, no new config, no new env vars.

---

## Sources & References

- `packages/core/src/tools/builtin.ts` — builtin tool pattern
- `packages/core/src/tools/builtin.test.ts` — test pattern
- `packages/core/src/tools/protected.ts` — tool identity and protection
- `packages/core/src/tools/search-files.ts` — separate-file tool definition pattern
- `packages/core/src/soul/resolve.ts` — `getProfileSoulDir()`
- `packages/core/src/soul/templates.ts` — `MEMORY_TEMPLATE`
- `packages/core/src/soul/compose.ts` — MEMORY.md injection into system prompt
- `packages/core/src/soul/save.ts` — `writeSoulFile()` utility
- `packages/core/src/fs.ts` — `readTextIfExists`, `writePrivateTextFile`
- `packages/core/src/contract.ts` — `ToolContext`, `ToolDefinition`
