import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getUserConfigDir, pathExists } from "@tinyclaw/core";
import { parseSkillMarkdown } from "./parse";
import {
  getGlobalSkillsDir,
  getProfileSkillsDir,
  SKILL_FILE_NAME,
} from "./paths";

export interface CreateSkillFileOptions {
  name: string;
  description: string;
  body?: string;
  disableModelInvocation?: boolean;
  orgId?: string;
  profileId?: string;
}

export function composeSkillMarkdown(options: {
  name: string;
  description: string;
  body?: string;
  disableModelInvocation?: boolean;
}): string {
  const lines = [
    "---",
    `name: ${options.name}`,
    `description: ${options.description}`,
  ];

  if (options.disableModelInvocation) {
    lines.push("disable-model-invocation: true");
  }

  lines.push("---", "", options.body?.trim() ?? "");

  return `${lines.join("\n").trimEnd()}\n`;
}

export async function createSkillFile(options: CreateSkillFileOptions): Promise<string> {
  const name = options.name.trim().toLowerCase();
  const description = options.description.trim();
  const skillsRoot =
    options.orgId && options.profileId
      ? getProfileSkillsDir(options.orgId, options.profileId)
      : getGlobalSkillsDir();
  const directory = path.join(skillsRoot, name);
  const skillFilePath = path.join(directory, SKILL_FILE_NAME);

  if (await pathExists(skillFilePath)) {
    throw new Error(`Skill "${name}" already exists.`);
  }

  const content = composeSkillMarkdown({
    name,
    description,
    body: options.body,
    disableModelInvocation: options.disableModelInvocation,
  });

  parseSkillMarkdown(content, skillFilePath);

  await mkdir(directory, { recursive: true });
  await writeFile(skillFilePath, content, "utf8");

  return directory;
}

function isManagedSkillDirectory(directory: string): boolean {
  const configDir = path.resolve(getUserConfigDir());
  const resolved = path.resolve(directory);

  if (!resolved.startsWith(`${configDir}${path.sep}`)) {
    return false;
  }

  const relative = path.relative(configDir, resolved);
  const parts = relative.split(path.sep);

  if (parts[0] === "agent" && parts[1] === "skills" && parts.length >= 3) {
    return true;
  }

  return parts[0] === "orgs" && parts[2] === "profiles" && parts[4] === "skills" && parts.length >= 6;
}

export async function deleteSkillDirectory(directory: string): Promise<void> {
  if (!isManagedSkillDirectory(directory)) {
    throw new Error("Skill directory is outside the allowed skills path.");
  }

  await rm(directory, { recursive: true, force: true });
}
