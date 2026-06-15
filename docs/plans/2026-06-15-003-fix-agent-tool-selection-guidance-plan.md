---
title: "fix: Improve agent tool selection between memory append and skill creation"
type: fix
status: active
date: 2026-06-15
---

# Improve Agent Tool Selection Between Memory Append and Skill Creation

## Summary

The agent has two tools for persisting information across sessions — `update_profile_memory` (stores facts in MEMORY.md) and `create_skill` (saves repeatable workflows in SKILL.md) — but their descriptions lack guidance on when to use one over the other. This leads the agent to store actionable step-by-step procedures as memory entries when they should be saved as skills instead. The tool descriptions and system prompt guidance need to be clarified so the model can reliably distinguish between facts to remember and procedures to execute.

---

## Problem Frame

Each tinyclaw profile has separate stores for different kinds of persistent content:

- **MEMORY.md** — cross-session facts, preferences, decisions, and context (`update_profile_memory`)
- **SKILL.md** — repeatable workflows, step-by-step instructions the agent executes (`create_skill`)

The current tool descriptions are ambiguous:

- `update_profile_memory`: *"Append a structured fact to the active profile's MEMORY.md for continuity across conversations."* — does not say what kinds of content belong here versus in a skill
- `create_skill`: *"Create a reusable skill for the active profile and assign it immediately. Use when the agent needs to save a repeatable workflow."* — has a hint but could be more explicit about the "step-by-step" nature

The model has no way to distinguish between "store this fact" and "save this procedure" from the descriptions alone. Adding system prompt guidance (following the existing `todo_write` pattern) further reinforces the distinction.

---

## Requirements

- R1. Agent can reliably distinguish between facts suitable for MEMORY.md vs. procedures suitable for SKILL.md
- R2. Tool descriptions clearly state what kind of content each tool accepts and when to use which
- R3. System prompt includes conditional guidance (when both tools are available) directing the agent to choose based on content type
- R4. Existing tests continue to pass; new tests cover the system prompt guidance

---

## Scope Boundaries

- No changes to tool implementation logic (`runUpdateProfileMemory`, `runCreateSkill`)
- No changes to MEMORY.md format, SKILL.md format, or soul stack composition
- No changes to `contract.ts`, `schema.ts`, or any server-side code
- No changes to how tools are registered or loaded
- No new tool files — only description strings and system prompt text

---

## Context & Research

### Relevant Code

- `packages/core/src/tools/profile-memory.ts:41` — `update_profile_memory` description and `content` parameter description
- `packages/core/src/tools/builtin.ts:155` — `create_skill` description and its parameter descriptions
- `packages/agent/src/chat-prompt.ts:50-57` — conditional `todo_write` guidance pattern (exact pattern to follow for memory/skills guidance)
- `packages/agent/src/chat-prompt.test.ts:29-37` — test pattern for system prompt guidance assertions
- `packages/core/src/contract.ts:927-932` — `ToolDefinition` interface; description is the sole LLM selection signal
- `packages/core/src/tools/schema.ts` — `toLlmToolDefinition()` passes description through unchanged

### Design Rationale

- The `todo_write` guidance pattern (name-gated conditional in `chat-prompt.ts`) is the established convention for tool-specific system prompt instructions — follow it exactly
- Tool descriptions are the LLM's only selection signal (no enrichment layer exists), so description quality is critical
- The existing three-tier storage model (Skills = instructions/matched per-turn, Memory = continuity/always-injected, KB = on-demand query) remains unchanged; this plan only improves the agent's ability to choose correctly between the first two

---

## Implementation Units

### U1. Update tool descriptions

**Goal:** Clarify `update_profile_memory` and `create_skill` descriptions so the model can distinguish facts from procedures.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `packages/core/src/tools/profile-memory.ts` (tool + parameter descriptions)
- Modify: `packages/core/src/tools/builtin.ts` (tool + parameter descriptions)

**Approach:**
- `update_profile_memory` description: Replace with text emphasizing facts, observations, preferences, personal context, and cross-session continuity — things the agent *knows*, not things the agent *does*. The `content` parameter description should say "Fact or observation to remember" or similar
- `create_skill` description: Replace with text emphasizing step-by-step procedures, repeatable workflows, multi-step instructions the agent executes for the user. The `body` parameter description should say "Step-by-step instructions for the agent to follow" or similar

**Patterns to follow:**
- Existing tool description format at `packages/core/src/tools/profile-memory.ts:41` and `packages/core/src/tools/builtin.ts:155`

**Test expectation:** none — description changes are behavioral (the LLM consumes them at inference time) and are not asserted by unit tests

**Verification:**
- `bun test packages/core/src/tools/` passes (no regressions)
- Descriptions are reviewable in the source files

---

### U2. Add system prompt guidance for tool selection

**Goal:** Add conditional guidance in the system prompt directing the agent to choose between `update_profile_memory` and `create_skill` based on content type.

**Requirements:** R3

**Dependencies:** None (guidance references tool names that already exist)

**Files:**
- Modify: `packages/agent/src/chat-prompt.ts`

**Approach:**
- Follow the exact `todo_write` conditional pattern at `chat-prompt.ts:50`:
  - After the existing `enableToolLoop` preamble (line 44-48), add guidance gated on the presence of each tool
  - For `update_profile_memory`: "Use update_profile_memory to record facts, preferences, and personal context — things you know about the user, not procedures you follow."
  - For `create_skill`: "Use create_skill to save step-by-step workflows and repeatable procedures — actions the agent takes, not facts to remember."
  - Place after the `todo_write` block (line 58) to keep related tool-guidance sections together

**Patterns to follow:**
- `packages/agent/src/chat-prompt.ts:50-57` — conditional tool guidance structure

**Test scenarios:**
- Guidance for `update_profile_memory` appears when the tool is in the array
- Guidance for `create_skill` appears when the tool is in the array
- Guidance is absent when neither tool is present
- Guidance text contains key disambiguation phrases

**Verification:**
- `bun test packages/agent/src/chat-prompt.test.ts` passes

---

### U3. Add tests for system prompt guidance

**Goal:** Cover the new conditional guidance with unit tests following the existing pattern.

**Requirements:** R4

**Dependencies:** U2

**Files:**
- Modify: `packages/agent/src/chat-prompt.test.ts`

**Approach:**
- Follow the exact test pattern from `chat-prompt.test.ts:29`:
  - Pass minimal `ToolDefinition`-shaped objects (just `name`, `description`, `parameters`)
  - Assert on string inclusion of key guidance phrases
  - Test each tool independently and together

**Test scenarios:**
- **Happy path:** `buildChatSystemPrompt` includes memory guidance when `update_profile_memory` is in the tool array
- **Happy path:** `buildChatSystemPrompt` includes skill guidance when `create_skill` is in the tool array
- **Happy path:** `buildChatSystemPrompt` includes both guidance blocks when both tools are present
- **Edge case:** Guidance is absent when only other tools (e.g., `write_file`) are present
- **Edge case:** Guidance is absent when `enableToolLoop` is false (tools are not relevant)

**Verification:**
- `bun test packages/agent/src/chat-prompt.test.ts` passes

---

## System-Wide Impact

- **Agent experience:** The model will more reliably route content to the right store — facts to MEMORY.md, procedures to SKILL.md — reducing stale memory entries and surfacing skills when they're most useful
- **Backward compatibility:** Existing MEMORY.md and SKILL.md files are unaffected; tool usage persists from the previous session
- **No configuration or migration needed**

---

## Risks & Dependencies

- **LLM compliance:** Different models may weigh tool descriptions differently. This plan relies on the standard LLM function-calling behavior where the `description` field is the primary selection signal. Follow-up: if a model consistently misclassifies, the system prompt guidance (U2) provides a second reinforcement path
- **No conflicts with concurrent work in this repo**

---

## Documentation / Operational Notes

No operational changes. The feature is entirely additive — no migration, no new config, no new env vars.

---

## Sources & References

- `packages/core/src/tools/profile-memory.ts` — `update_profile_memory` tool definition
- `packages/core/src/tools/builtin.ts:155` — `create_skill` tool definition
- `packages/agent/src/chat-prompt.ts:50-57` — conditional `todo_write` guidance pattern
- `packages/agent/src/chat-prompt.test.ts:29-37` — test pattern for prompt guidance
- `packages/core/src/contract.ts:927-932` — `ToolDefinition` interface
