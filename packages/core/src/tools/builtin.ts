import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ToolContext, ToolDefinition } from "../contract";
import { getProfileSoulDir } from "../soul/resolve";
import { getCustomToolsDir, guardFilePath, PathGuardError, type PathGuardOptions } from "./paths";
import { searchFilesTool } from "./search-files";
import { knowledgeBaseSearchTool } from "./knowledge-base-search";
import { webSearchTool } from "./web-search";
import { updateProfileMemoryTool } from "./profile-memory";
import { emailTool } from "./email";

export interface WriteFileInput {
  path: string;
  content: string;
  cwd?: string;
}

export interface WriteFileOutput {
  path: string;
  bytesWritten: number;
}

export interface DeleteFileInput {
  path: string;
  cwd?: string;
}

export interface DeleteFileOutput {
  path: string;
  deleted: true;
}

export interface ReadFileInput {
  path: string;
  cwd?: string;
  offset?: number;
  limit?: number;
}

export interface ReadFileOutput {
  path: string;
  content: string;
  bytesRead: number;
  startLine: number;
  endLine: number;
  totalLines: number;
  truncated: boolean;
}

export interface CreateSkillInput {
  name: string;
  description: string;
  body?: string;
  disableModelInvocation?: boolean;
}

interface FileToolRunOptions {
  workspaceRoot?: string;
}

let defaultGuardOptions: PathGuardOptions = {};

const BLOCKED_READ_BASENAMES = ["config.ini"];

export function setDefaultFileGuardOptions(options: PathGuardOptions): void {
  defaultGuardOptions = { ...options };
}

function buildFileGuardOptions(
  context: ToolContext,
  options: FileToolRunOptions = {},
): PathGuardOptions {
  const profileId = context.profileId?.trim();
  if (!profileId) {
    throw new Error("profileId is required.");
  }

  const workspaceRoot = options.workspaceRoot ?? getProfileSoulDir(profileId);

  return {
    ...defaultGuardOptions,
    allowedDirs: [workspaceRoot, getCustomToolsDir()],
    cwd: workspaceRoot,
  };
}

export const writeFileTool: ToolDefinition<WriteFileInput, WriteFileOutput> = {
  name: "write_file",
  description:
    "Write text content to a file in the active profile workspace. Creates parent directories if needed.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "File path to write, relative to the profile workspace unless absolute.",
      },
      content: { type: "string", description: "Text content to write." },
      cwd: {
        type: "string",
        description:
          "Optional base directory within the profile workspace for relative paths. Defaults to the profile workspace root.",
      },
    },
    required: ["path", "content"],
    additionalProperties: false,
  },
  run(input, context) {
    return runWriteFile(input, context);
  },
};

export async function runWriteFile(
  input: unknown,
  context: ToolContext,
  options: FileToolRunOptions = {},
): Promise<WriteFileOutput> {
  const rawPath = readRequiredString(input, "path");
  const content = readRequiredString(input, "content");
  const rawCwd = readOptionalString(input, "cwd");
  const contentBytes = Buffer.byteLength(content, "utf8");
  const guardOptions = buildFileGuardOptions(context, options);

  const guarded = await guardFilePath(rawPath, rawCwd, contentBytes, guardOptions);
  const filePath = guarded.resolved;

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");

  return { path: filePath, bytesWritten: contentBytes };
}

export const deleteFileTool: ToolDefinition<DeleteFileInput, DeleteFileOutput> = {
  name: "delete_file",
  description:
    "Delete a file from disk. Only files within the profile workspace or custom tools directory can be deleted.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "File path to delete. Must be within the profile workspace or custom tools directory.",
      },
      cwd: {
        type: "string",
        description:
          "Optional base directory within the profile workspace for relative paths. Defaults to the profile workspace root.",
      },
    },
    required: ["path"],
    additionalProperties: false,
  },
  run(input, context) {
    return runDeleteFile(input, context);
  },
};

export async function runDeleteFile(
  input: unknown,
  context: ToolContext,
  options: FileToolRunOptions = {},
): Promise<DeleteFileOutput> {
  const rawPath = readRequiredString(input, "path");
  const rawCwd = readOptionalString(input, "cwd");
  const guardOptions = buildFileGuardOptions(context, options);

  const guarded = await guardFilePath(rawPath, rawCwd, undefined, guardOptions);
  await unlink(guarded.resolved);

  return { path: guarded.resolved, deleted: true };
}

export const readFileTool: ToolDefinition<ReadFileInput, ReadFileOutput> = {
  name: "read_file",
  description:
    "Read text from a file in the active profile workspace. Use offset/limit for large files.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "File path to read, relative to the profile workspace unless absolute.",
      },
      cwd: {
        type: "string",
        description:
          "Optional base directory within the profile workspace for relative paths. Defaults to the profile workspace root.",
      },
      offset: {
        type: "number",
        description: "Optional 1-based line number to start reading from. Defaults to 1.",
      },
      limit: {
        type: "number",
        description: "Optional maximum number of lines to return.",
      },
    },
    required: ["path"],
    additionalProperties: false,
  },
  run(input, context) {
    return runReadFile(input, context);
  },
};

export async function runReadFile(
  input: unknown,
  context: ToolContext,
  options: FileToolRunOptions = {},
): Promise<ReadFileOutput> {
  const rawPath = readRequiredString(input, "path");
  const rawCwd = readOptionalString(input, "cwd");
  const offset = readOptionalPositiveInt(input, "offset") ?? 1;
  const limit = readOptionalPositiveInt(input, "limit");
  const guardOptions = buildFileGuardOptions(context, options);
  const maxBytes = guardOptions.maxFileBytes ?? 10 * 1024 * 1024;

  const guarded = await guardFilePath(rawPath, rawCwd, undefined, guardOptions);
  const filePath = guarded.resolved;

  if (BLOCKED_READ_BASENAMES.includes(path.basename(filePath).toLowerCase())) {
    throw new PathGuardError(
      `Reading ${path.basename(filePath)} is not allowed`,
      "SPECIAL_FILE",
    );
  }

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    throw new Error(`File not found: ${filePath}`);
  }

  if (!fileStat.isFile()) {
    throw new Error(`Path is not a file: ${filePath}`);
  }

  if (fileStat.size > maxBytes) {
    throw new PathGuardError(
      `File content exceeds max ${maxBytes} bytes (got ${fileStat.size})`,
      "TOO_LARGE",
    );
  }

  const rawContent = await readFile(filePath, "utf8");
  const lines = rawContent.length === 0 ? [] : rawContent.split("\n");
  const totalLines = lines.length;
  const startLine = Math.min(Math.max(1, offset), totalLines === 0 ? 1 : totalLines + 1);
  const startIndex = startLine - 1;
  const endIndex =
    limit != null ? Math.min(startIndex + limit, totalLines) : totalLines;
  const slice = lines.slice(startIndex, endIndex);
  const content = slice.join("\n");
  const endLine = slice.length > 0 ? startLine + slice.length - 1 : Math.max(0, startLine - 1);

  return {
    path: filePath,
    content,
    bytesRead: Buffer.byteLength(content, "utf8"),
    startLine,
    endLine,
    totalLines,
    truncated: endIndex < totalLines,
  };
}

export const createSkillTool: ToolDefinition<CreateSkillInput> = {
  name: "create_skill",
  description:
    "Save a step-by-step procedure or repeatable workflow as a skill for the active profile and assign it immediately. Use for actions the agent executes — multi-step instructions, workflows, and processes. Not for facts or observations (use update_profile_memory for those).",
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Unique skill name for the active profile.",
      },
      description: {
        type: "string",
        description: "Short summary explaining when the skill should be used.",
      },
      body: {
        type: "string",
        description: "Optional step-by-step instructions for the agent to follow when this skill activates.",
      },
      disableModelInvocation: {
        type: "boolean",
        description: "When true, the skill only activates on explicit invocation.",
      },
    },
    required: ["name", "description"],
    additionalProperties: false,
  },
  async run() {
    throw new Error("create_skill must be resolved by the TinyClaw server.");
  },
};

export const builtinTools: ToolDefinition[] = [
  writeFileTool,
  deleteFileTool,
  readFileTool,
  createSkillTool,
  searchFilesTool,
  knowledgeBaseSearchTool,
  webSearchTool,
  updateProfileMemoryTool,
  emailTool,
];

function readRequiredString(input: unknown, key: string): string {
  const value = readOptionalString(input, key);

  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

function readOptionalString(input: unknown, key: string): string | null {
  if (typeof input !== "object" || input === null || !(key in input)) {
    return null;
  }

  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readOptionalPositiveInt(input: unknown, key: string): number | null {
  if (typeof input !== "object" || input === null || !(key in input)) {
    return null;
  }

  const value = (input as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

export { PathGuardError };
