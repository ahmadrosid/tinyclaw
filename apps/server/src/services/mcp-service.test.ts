import { describe, expect, test } from "bun:test";
import { createId } from "@tinyclaw/core";
import { createInMemoryDatabaseAdapter } from "@tinyclaw/db";
import { McpClientManager } from "./mcp-client-manager";
import { McpService } from "./mcp-service";

async function seedProfile(db: ReturnType<typeof createInMemoryDatabaseAdapter>) {
  const now = new Date().toISOString();
  const profile = {
    id: createId("profile"),
    name: "Test Bot",
    systemPrompt: "You are helpful.",
    model: null,
    isSuper: false,
    createdAt: now,
    updatedAt: now,
  };

  await db.upsertProfile(profile);

  return profile.id;
}

describe("McpService", () => {
  test("creates and lists MCP servers", async () => {
    const db = createInMemoryDatabaseAdapter();
    const service = new McpService(db, new McpClientManager());

    await service.createServer({
      name: "demo",
      transport: "http",
      config: { url: "https://example.com/mcp" },
      connect: false,
    });

    const listed = await service.listServers();

    expect(listed.servers).toHaveLength(1);
    expect(listed.servers[0]?.name).toBe("demo");
    expect(listed.servers[0]?.toolCount).toBe(0);
  });

  test("assigns MCP servers to profiles", async () => {
    const db = createInMemoryDatabaseAdapter();
    const service = new McpService(db, new McpClientManager());

    const created = await service.createServer({
      name: "demo",
      transport: "http",
      config: { url: "https://example.com/mcp" },
      connect: false,
    });

    const profileId = await seedProfile(db);

    await service.assignServerToProfile(profileId, created.server.id);

    const assigned = await db.listMcpServersForProfile(profileId);

    expect(assigned).toHaveLength(1);
    expect(assigned[0]?.id).toBe(created.server.id);
  });

  test("deleting a server removes profile assignments", async () => {
    const db = createInMemoryDatabaseAdapter();
    const service = new McpService(db, new McpClientManager());

    const created = await service.createServer({
      name: "demo",
      transport: "http",
      config: { url: "https://example.com/mcp" },
      connect: false,
    });

    const profileId = await seedProfile(db);
    await service.assignServerToProfile(profileId, created.server.id);
    await service.deleteServer(created.server.id);

    const assigned = await db.listMcpServersForProfile(profileId);

    expect(assigned).toHaveLength(0);
  });
});
