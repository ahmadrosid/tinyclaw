import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type {
  CachedMcpToolSummary,
  McpHttpConfig,
  McpTransport,
} from "@tinyclaw/core";
import type { CachedMcpTool, StoredMcpServerRecord } from "@tinyclaw/db";

interface ConnectedMcpClient {
  client: Client;
  transport: Transport;
}

export class McpClientManager {
  private readonly connections = new Map<string, ConnectedMcpClient>();

  isConnected(serverId: string): boolean {
    return this.connections.has(serverId);
  }

  getConnectedCount(): number {
    return this.connections.size;
  }

  async connect(server: StoredMcpServerRecord): Promise<CachedMcpTool[]> {
    await this.disconnect(server.id);

    const transport = createTransport(server.transport, server.config);
    const client = new Client({
      name: "tinyclaw",
      version: "1.0.0",
    });

    await client.connect(transport);
    const result = await client.listTools();
    const tools = normalizeListedTools(result.tools);

    this.connections.set(server.id, { client, transport });

    return tools;
  }

  async disconnect(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);

    if (!connection) {
      return;
    }

    this.connections.delete(serverId);

    try {
      await connection.transport.close();
    } catch {
      // Ignore transport shutdown errors.
    }
  }

  async disconnectAll(): Promise<void> {
    const serverIds = [...this.connections.keys()];

    for (const serverId of serverIds) {
      await this.disconnect(serverId);
    }
  }

  async listTools(serverId: string): Promise<CachedMcpTool[]> {
    const client = this.requireClient(serverId);
    const result = await client.listTools();
    return normalizeListedTools(result.tools);
  }

  async callTool(
    serverId: string,
    toolName: string,
    input: unknown,
  ): Promise<unknown> {
    const client = this.requireClient(serverId);
    const result = await client.callTool({
      name: toolName,
      arguments: asToolArguments(input),
    });

    if ("toolResult" in result) {
      return result.toolResult;
    }

    if (result.isError) {
      return {
        error: formatToolContent(result.content),
      };
    }

    if (result.structuredContent !== undefined) {
      return result.structuredContent;
    }

    return {
      content: result.content,
      text: formatToolContent(result.content),
    };
  }

  async testConnection(
    transport: McpTransport,
    config: unknown,
  ): Promise<CachedMcpTool[]> {
    const mcpTransport = createTransport(transport, config);
    const client = new Client({
      name: "tinyclaw",
      version: "1.0.0",
    });

    try {
      await client.connect(mcpTransport);
      const result = await client.listTools();
      return normalizeListedTools(result.tools);
    } finally {
      try {
        await mcpTransport.close();
      } catch {
        // Ignore transport shutdown errors.
      }
    }
  }

  private requireClient(serverId: string): Client {
    const connection = this.connections.get(serverId);

    if (!connection) {
      throw new Error(`MCP server "${serverId}" is not connected.`);
    }

    return connection.client;
  }
}

function createTransport(transport: McpTransport, config: unknown): Transport {
  if (transport !== "http") {
    throw new Error('MCP transport must be "http".');
  }

  const http = readHttpConfig(config);

  return new StreamableHTTPClientTransport(new URL(http.url), {
    requestInit: {
      headers: http.headers,
    },
  });
}

function readHttpConfig(config: unknown): McpHttpConfig {
  if (typeof config !== "object" || config === null) {
    throw new Error("HTTP MCP servers require config.url.");
  }

  const record = config as Record<string, unknown>;
  const url = typeof record.url === "string" && record.url.trim() ? record.url.trim() : null;

  if (!url) {
    throw new Error("HTTP MCP servers require config.url.");
  }

  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid MCP server URL: ${url}`);
  }

  return {
    url,
    headers: readStringRecord(record.headers),
  };
}

function readStringRecord(value: unknown): Record<string, string> | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record: Record<string, string> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") {
      record[key] = entry;
    }
  }

  return Object.keys(record).length > 0 ? record : undefined;
}

function normalizeListedTools(
  tools: Array<{
    name: string;
    description?: string;
    inputSchema?: unknown;
  }>,
): CachedMcpTool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description?.trim() || tool.name,
    inputSchema: tool.inputSchema,
  }));
}

function asToolArguments(input: unknown): Record<string, unknown> {
  if (typeof input === "object" && input !== null && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }

  return {};
}

function formatToolContent(
  content: Array<{ type: string; text?: string }> | undefined,
): string {
  if (!content || content.length === 0) {
    return "Tool completed with no content.";
  }

  return content
    .map((part) => {
      if (part.type === "text" && typeof part.text === "string") {
        return part.text;
      }

      return JSON.stringify(part);
    })
    .join("\n");
}

export function toCachedMcpToolSummaries(tools: CachedMcpTool[]): CachedMcpToolSummary[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }));
}
