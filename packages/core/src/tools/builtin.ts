import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ToolContext, ToolDefinition } from "../contract";
import { guardFilePath, PathGuardError, type PathGuardOptions } from "./paths";
import { webSearchTool } from "./web-search";

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

let defaultGuardOptions: PathGuardOptions = {};

export function setDefaultFileGuardOptions(options: PathGuardOptions): void {
  defaultGuardOptions = { ...options };
}

export const writeFileTool: ToolDefinition<WriteFileInput, WriteFileOutput> = {
  name: "write_file",
  description: "Write text content to a file. Creates parent directories if needed.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path to write." },
      content: { type: "string", description: "Text content to write." },
      cwd: {
        type: "string",
        description: "Base directory for relative paths. Defaults to the server working directory.",
      },
    },
    required: ["path", "content"],
    additionalProperties: false,
  },
  async run(input, context: ToolContext) {
    const rawPath = readRequiredString(input, "path");
    const content = readRequiredString(input, "content");
    const rawCwd = readOptionalString(input, "cwd");
    const contentBytes = Buffer.byteLength(content, "utf8");

    const guardOptions: PathGuardOptions = { ...defaultGuardOptions };
    if (context.sessionId && !guardOptions.cwd) {
      guardOptions.cwd = process.cwd();
    }

    const guarded = await guardFilePath(rawPath, rawCwd, contentBytes, guardOptions);
    const filePath = guarded.resolved;

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf8");

    return { path: filePath, bytesWritten: contentBytes };
  },
};

export const deleteFileTool: ToolDefinition<DeleteFileInput, DeleteFileOutput> = {
  name: "delete_file",
  description: "Delete a file from disk. Only files within the allowed workspace can be deleted.",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "File path to delete. Must be within the allowed workspace." },
      cwd: {
        type: "string",
        description: "Base directory for relative paths. Defaults to the server working directory.",
      },
    },
    required: ["path"],
    additionalProperties: false,
  },
  async run(input, context: ToolContext) {
    const rawPath = readRequiredString(input, "path");
    const rawCwd = readOptionalString(input, "cwd");

    const guardOptions: PathGuardOptions = { ...defaultGuardOptions };
    if (context.sessionId && !guardOptions.cwd) {
      guardOptions.cwd = process.cwd();
    }

    const guarded = await guardFilePath(rawPath, rawCwd, undefined, guardOptions);
    await unlink(guarded.resolved);

    return { path: guarded.resolved, deleted: true };
  },
};

export const builtinTools: ToolDefinition[] = [
  writeFileTool,
  deleteFileTool,
  webSearchTool,
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

export { PathGuardError };
