import type {
  CreateMcpServerRequest,
  ListMcpServersResponse,
  McpHttpConfig,
  McpServerDetail,
  McpServerResponse,
  McpServerSummary,
  McpTransport,
  TestMcpServerResponse,
  UpdateMcpServerRequest,
} from "@tinyclaw/core";
import { createId } from "@tinyclaw/core";
import type { CachedMcpTool, DatabaseAdapter, StoredMcpServerRecord } from "@tinyclaw/db";
import {
  McpClientManager,
  toCachedMcpToolSummaries,
} from "./mcp-client-manager";

export class McpService {
  constructor(
    private readonly db: DatabaseAdapter,
    private readonly manager: McpClientManager,
  ) {}

  async listServers(): Promise<ListMcpServersResponse> {
    const servers = await this.db.listMcpServers();
    return { servers: servers.map((server) => toMcpServerSummary(server)) };
  }

  async getServer(serverId: string): Promise<McpServerResponse> {
    const server = await this.requireServer(serverId);
    return { server: toMcpServerDetail(server) };
  }

  async createServer(request: CreateMcpServerRequest): Promise<McpServerResponse> {
    const name = request.name.trim();

    if (!name) {
      throw new Error("MCP server name is required.");
    }

    validateTransport(request.transport);
    validateConfig(request.transport, request.config);

    const existing = await this.db.getMcpServerByName(name);

    if (existing) {
      throw new Error(`MCP server already exists: ${name}`);
    }

    const now = new Date().toISOString();
    const record: StoredMcpServerRecord = {
      id: createId("mcp"),
      name,
      transport: request.transport,
      config: request.config,
      enabled: request.enabled ?? true,
      status: "disconnected",
      lastError: null,
      cachedTools: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.db.upsertMcpServer(record);

    if (request.connect !== false && record.enabled) {
      await this.connectServer(record.id);
      return this.getServer(record.id);
    }

    return { server: toMcpServerDetail(record) };
  }

  async updateServer(
    serverId: string,
    request: UpdateMcpServerRequest,
  ): Promise<McpServerResponse> {
    const server = await this.requireServer(serverId);
    const nextName = request.name?.trim() ?? server.name;

    if (!nextName) {
      throw new Error("MCP server name is required.");
    }

    if (nextName !== server.name) {
      const existing = await this.db.getMcpServerByName(nextName);

      if (existing && existing.id !== serverId) {
        throw new Error(`MCP server already exists: ${nextName}`);
      }
    }

    const transport = request.transport ?? server.transport;
    const config = request.config ?? server.config;

    if (request.transport !== undefined) {
      validateTransport(transport);
    }

    validateConfig(transport, config);

    const updated: StoredMcpServerRecord = {
      ...server,
      name: nextName,
      transport,
      config,
      enabled: request.enabled ?? server.enabled,
      updatedAt: new Date().toISOString(),
    };

    const configChanged =
      JSON.stringify(server.config) !== JSON.stringify(config) ||
      server.transport !== transport;

    if (configChanged && this.manager.isConnected(serverId)) {
      await this.manager.disconnect(serverId);
      updated.status = "disconnected";
      updated.lastError = null;
    }

    await this.db.upsertMcpServer(updated);

    return this.getServer(serverId);
  }

  async deleteServer(serverId: string): Promise<void> {
    await this.requireServer(serverId);
    await this.manager.disconnect(serverId);

    const deleted = await this.db.deleteMcpServer(serverId);

    if (!deleted) {
      throw new Error("MCP server not found.");
    }
  }

  async connectServer(serverId: string): Promise<McpServerResponse> {
    const server = await this.requireServer(serverId);

    if (!server.enabled) {
      throw new Error(`MCP server "${server.name}" is disabled.`);
    }

    try {
      const cachedTools = await this.manager.connect(server);
      const updated: StoredMcpServerRecord = {
        ...server,
        status: "connected",
        lastError: null,
        cachedTools,
        updatedAt: new Date().toISOString(),
      };

      await this.db.upsertMcpServer(updated);

      return { server: toMcpServerDetail(updated) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const updated: StoredMcpServerRecord = {
        ...server,
        status: "error",
        lastError: message,
        updatedAt: new Date().toISOString(),
      };

      await this.db.upsertMcpServer(updated);
      throw new Error(message);
    }
  }

  async syncServer(serverId: string): Promise<McpServerResponse> {
    const server = await this.requireServer(serverId);

    if (!this.manager.isConnected(serverId)) {
      return this.connectServer(serverId);
    }

    try {
      const cachedTools = await this.manager.listTools(serverId);
      const updated: StoredMcpServerRecord = {
        ...server,
        status: "connected",
        lastError: null,
        cachedTools,
        updatedAt: new Date().toISOString(),
      };

      await this.db.upsertMcpServer(updated);

      return { server: toMcpServerDetail(updated) };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const updated: StoredMcpServerRecord = {
        ...server,
        status: "error",
        lastError: message,
        updatedAt: new Date().toISOString(),
      };

      await this.db.upsertMcpServer(updated);
      throw new Error(message);
    }
  }

  async testServer(
    transport: McpTransport,
    config: McpHttpConfig,
  ): Promise<TestMcpServerResponse> {
    validateTransport(transport);
    validateConfig(transport, config);

    try {
      const tools = await this.manager.testConnection(transport, config);

      return {
        ok: true,
        toolCount: tools.length,
        tools: toCachedMcpToolSummaries(tools),
      };
    } catch (error) {
      return {
        ok: false,
        toolCount: 0,
        tools: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async connectEnabledServers(): Promise<void> {
    const servers = await this.db.listMcpServers();

    for (const server of servers) {
      if (!server.enabled) {
        continue;
      }

      try {
        await this.connectServer(server.id);
      } catch (error) {
        console.warn(
          `Could not connect MCP server "${server.name}":`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  async assignServerToProfile(profileId: string, serverId: string): Promise<void> {
    const profile = await this.db.getProfile(profileId);

    if (!profile) {
      throw new Error("Profile not found.");
    }

    await this.requireServer(serverId);
    await this.db.assignMcpServerToProfile(profileId, serverId);
  }

  async unassignServerFromProfile(profileId: string, serverId: string): Promise<void> {
    const profile = await this.db.getProfile(profileId);

    if (!profile) {
      throw new Error("Profile not found.");
    }

    const removed = await this.db.unassignMcpServerFromProfile(profileId, serverId);

    if (!removed) {
      throw new Error("MCP server is not assigned to this profile.");
    }
  }

  async getStatusSummary(): Promise<{
    serverCount: number;
    connectedCount: number;
    assignedProfileCount: number;
  }> {
    const servers = await this.db.listMcpServers();

    return {
      serverCount: servers.length,
      connectedCount: this.manager.getConnectedCount(),
      assignedProfileCount: await this.db.countProfileMcpAssignments(),
    };
  }

  private async requireServer(serverId: string): Promise<StoredMcpServerRecord> {
    const server = await this.db.getMcpServer(serverId);

    if (!server) {
      throw new Error("MCP server not found.");
    }

    return server;
  }
}

function toMcpServerSummary(server: StoredMcpServerRecord): McpServerSummary {
  return {
    id: server.id,
    name: server.name,
    transport: server.transport,
    enabled: server.enabled,
    status: server.status,
    toolCount: server.cachedTools.length,
    lastError: server.lastError,
    createdAt: server.createdAt,
    updatedAt: server.updatedAt,
  };
}

function toMcpServerDetail(server: StoredMcpServerRecord): McpServerDetail {
  return {
    ...toMcpServerSummary(server),
    config: redactMcpConfig(server.transport, server.config),
    cachedTools: toCachedMcpToolSummaries(server.cachedTools),
  };
}

function redactMcpConfig(_transport: McpTransport, config: unknown): McpHttpConfig {
  const http =
    typeof config === "object" && config !== null
      ? (config as McpHttpConfig)
      : { url: "" };

  return {
    url: http.url,
    headers: redactStringRecord(http.headers),
  };
}

function redactStringRecord(
  value: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!value) {
    return undefined;
  }

  const redacted: Record<string, string> = {};

  for (const [key, entry] of Object.entries(value)) {
    redacted[key] = entry ? "••••••••" : entry;
  }

  return redacted;
}

function validateTransport(transport: string): asserts transport is McpTransport {
  if (transport !== "http") {
    throw new Error('MCP transport must be "http".');
  }
}

function validateConfig(transport: McpTransport, config: unknown): void {
  if (transport !== "http") {
    throw new Error('MCP transport must be "http".');
  }

  if (typeof config !== "object" || config === null) {
    throw new Error("MCP server config is required.");
  }

  const url = (config as Record<string, unknown>).url;

  if (typeof url !== "string" || !url.trim()) {
    throw new Error("HTTP MCP servers require config.url.");
  }

  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid MCP server URL: ${url}`);
  }
}

export function toMcpServerSummaries(servers: StoredMcpServerRecord[]): McpServerSummary[] {
  return servers.map((server) => toMcpServerSummary(server));
}
