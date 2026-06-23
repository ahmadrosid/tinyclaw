import { describe, expect, test } from "bun:test";
import { BUILTIN_TOOL_IDS } from "@tinyclaw/core/tools/protected";
import { createInMemoryDatabaseAdapter } from "./adapters/in-memory";
import { ensureBuiltinToolDefinitions, removeUnsupportedTools, seedDatabase } from "./seed";

describe("seed cleanup", () => {
  test("removes unsupported tool handler types", async () => {
    const db = createInMemoryDatabaseAdapter();
    const now = new Date().toISOString();

    await db.upsertProfile({
      id: "profile_test",
      name: "Test",
      systemPrompt: "test",
      model: null,
      isSuper: false,
      createdAt: now,
      updatedAt: now,
    });

    await db.upsertTool({
      id: "tool_custom",
      name: "legacy-custom",
      description: "Old unsupported tool",
      handlerType: "custom",
      handlerConfig: {},
      createdAt: now,
      updatedAt: now,
    });

    await db.assignToolToProfile("profile_test", "tool_custom");

    await removeUnsupportedTools(db);

    expect(await db.getTool("tool_custom")).toBeNull();
    expect(await db.listToolsForProfile("profile_test")).toHaveLength(0);
  });
});

describe("seed built-in tools", () => {
  test("registers built-in tool definitions without creating global profiles", async () => {
    const db = createInMemoryDatabaseAdapter();
    const now = new Date().toISOString();

    await db.upsertProfile({
      id: "profile_custom",
      name: "Custom Bot",
      systemPrompt: "custom",
      model: null,
      isSuper: false,
      createdAt: now,
      updatedAt: now,
    });

    await seedDatabase(db);

    const profiles = await db.listProfiles();

    expect(profiles.map((profile) => profile.id)).toEqual(["profile_custom"]);
    expect(await db.getTool(BUILTIN_TOOL_IDS.web_search)).not.toBeNull();
  });

  test("ensureBuiltinToolDefinitions upserts built-in tools idempotently", async () => {
    const db = createInMemoryDatabaseAdapter();

    await ensureBuiltinToolDefinitions(db);
    await ensureBuiltinToolDefinitions(db);

    expect(await db.getTool(BUILTIN_TOOL_IDS.create_skill)).not.toBeNull();
  });
});
