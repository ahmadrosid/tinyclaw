import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import type { CreateToolRequest, ProfileResponse, ToolSummary } from "@tinyclaw/core";
import type { ProfileService } from "../services/profile-service";
import {
  SuperBotSessionState,
  TOOL_ASSIGNMENT_CONFIRMATION_MESSAGE,
} from "../services/super-bot-session-state";
import { createSuperBotTools } from "./super-bot-tools";

const originalToolsDir = process.env.TINYCLAW_TOOLS_DIR;
const ORG_ID = "org_test";
const SESSION_ID = "session_test";

describe("super bot create_tool", () => {
  let tempToolsDir = "";

  afterEach(async () => {
    process.env.TINYCLAW_TOOLS_DIR = originalToolsDir;

    if (tempToolsDir) {
      await rm(tempToolsDir, { recursive: true, force: true });
      tempToolsDir = "";
    }
  });

  test("always registers agent-authored tools as javascript", async () => {
    tempToolsDir = await mkdtemp(path.join(os.tmpdir(), "tinyclaw-super-tool-"));
    process.env.TINYCLAW_TOOLS_DIR = tempToolsDir;
    await mkdir(tempToolsDir, { recursive: true });

    await writeFile(
      path.join(tempToolsDir, "echo.js"),
      `export async function run(input) {
  return input;
}
`,
      "utf8",
    );

    let capturedRequest: CreateToolRequest | null = null;

    const createTool = getCreateToolTool({
      async createTool(request: CreateToolRequest): Promise<ToolSummary> {
        capturedRequest = request;

        return {
          id: "tool_echo",
          name: request.name,
          description: request.description,
          handlerType: request.handlerType ?? "javascript",
        };
      },
    });

    const result = await createTool.run(
      {
        name: "echo",
        description: "Echo input",
        handlerConfig: { modulePath: "echo.js" },
      },
      { sessionId: SESSION_ID },
    );

    expect(capturedRequest).toEqual({
      name: "echo",
      description: "Echo input",
      handlerType: "javascript",
      handlerConfig: { modulePath: "echo.js" },
    });
    expect(result).toEqual({
      tool: {
        id: "tool_echo",
        name: "echo",
        description: "Echo input",
        handlerType: "javascript",
      },
    });
  });

  test('rejects handlerType "custom"', async () => {
    let createToolCalled = false;

    const createTool = getCreateToolTool({
      async createTool(): Promise<ToolSummary> {
        createToolCalled = true;
        throw new Error("should not be called");
      },
    });

    const error = await captureError(
      createTool.run({
        name: "bad-tool",
        description: "Bad tool",
        handlerType: "custom",
        handlerConfig: { modulePath: "bad-tool.js" },
      }),
    );

    expect(error?.message).toMatch(/only create javascript tools/i);
    expect(createToolCalled).toBe(false);
  });

  test("rejects missing javascript modules before storing the tool", async () => {
    tempToolsDir = await mkdtemp(path.join(os.tmpdir(), "tinyclaw-super-tool-"));
    process.env.TINYCLAW_TOOLS_DIR = tempToolsDir;
    await mkdir(tempToolsDir, { recursive: true });

    let createToolCalled = false;

    const createTool = getCreateToolTool({
      async createTool(): Promise<ToolSummary> {
        createToolCalled = true;
        throw new Error("should not be called");
      },
    });

    const error = await captureError(
      createTool.run({
        name: "missing",
        description: "Missing module",
        handlerConfig: { modulePath: "missing.js" },
      }),
    );

    expect(error?.message).toBe("Tool module not found: missing.js");
    expect(createToolCalled).toBe(false);
  });
});

describe("super bot assign_tool_to_profile", () => {
  const sessionState = new SuperBotSessionState();

  test("allows the first assignment for a tool created this turn", async () => {
    sessionState.beginTurn(SESSION_ID);
    sessionState.markToolCreated(SESSION_ID, "tool_weather");

    const assignTool = getAssignToolTool(
      {
        async assignTool(_orgId: string, profileId: string): Promise<ProfileResponse> {
          return {
            profile: {
              id: profileId,
              name: "Default Bot",
              model: null,
              isSuper: false,
              toolCount: 1,
              mcpServerCount: 0,
              soulActive: false,
              hasAvatar: false,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
              systemPrompt: "You are helpful.",
              tools: [],
              mcpServers: [],
              skills: [],
            },
          };
        },
      },
      sessionState,
    );

    await expect(
      assignTool.run(
        { profileId: "default", toolId: "tool_weather" },
        { sessionId: SESSION_ID, orgId: ORG_ID },
      ),
    ).resolves.toBeDefined();
  });

  test("blocks a second assignment for the same tool in the same turn", async () => {
    sessionState.beginTurn(SESSION_ID);
    sessionState.markToolCreated(SESSION_ID, "tool_weather");
    sessionState.markToolAssigned(SESSION_ID, "tool_weather");

    const assignTool = getAssignToolTool(
      {
        async assignTool(): Promise<ProfileResponse> {
          throw new Error("should not be called");
        },
      },
      sessionState,
    );

    const error = await captureError(
      assignTool.run(
        { profileId: "profile_other", toolId: "tool_weather" },
        { sessionId: SESSION_ID, orgId: ORG_ID },
      ),
    );

    expect(error?.message).toBe(TOOL_ASSIGNMENT_CONFIRMATION_MESSAGE);
  });

  test("allows another assignment after beginTurn reset", async () => {
    sessionState.beginTurn(SESSION_ID);
    sessionState.markToolCreated(SESSION_ID, "tool_weather");
    sessionState.markToolAssigned(SESSION_ID, "tool_weather");

    sessionState.beginTurn(SESSION_ID);

    let assignCalls = 0;

    const assignTool = getAssignToolTool(
      {
        async assignTool(_orgId: string, profileId: string): Promise<ProfileResponse> {
          assignCalls += 1;

          return {
            profile: {
              id: profileId,
              name: "Other Bot",
              model: null,
              isSuper: false,
              toolCount: 1,
              mcpServerCount: 0,
              soulActive: false,
              hasAvatar: false,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
              systemPrompt: "You are helpful.",
              tools: [],
              mcpServers: [],
              skills: [],
            },
          };
        },
      },
      sessionState,
    );

    await assignTool.run(
      { profileId: "profile_other", toolId: "tool_weather" },
      { sessionId: SESSION_ID, orgId: ORG_ID },
    );

    expect(assignCalls).toBe(1);
  });
});

function createTestTools(profileService: Pick<ProfileService, "createTool" | "assignTool">) {
  const sessionState = new SuperBotSessionState();
  sessionState.beginTurn(SESSION_ID);
  return createSuperBotTools(profileService as ProfileService, sessionState);
}

function getCreateToolTool(profileService: Pick<ProfileService, "createTool">) {
  const tool = createTestTools(profileService).find(
    (candidate) => candidate.name === "create_tool",
  );

  if (!tool) {
    throw new Error("create_tool was not registered");
  }

  return tool;
}

function getAssignToolTool(
  profileService: Pick<ProfileService, "assignTool">,
  sessionState: SuperBotSessionState,
) {
  const tool = createSuperBotTools(profileService as ProfileService, sessionState).find(
    (candidate) => candidate.name === "assign_tool_to_profile",
  );

  if (!tool) {
    throw new Error("assign_tool_to_profile was not registered");
  }

  return tool;
}

async function captureError(promise: Promise<unknown>): Promise<Error | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}
