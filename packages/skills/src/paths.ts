import { readdir } from "node:fs/promises";
import path from "node:path";
import { getUserConfigDir, pathExists } from "@tinyclaw/core";

export const SKILL_FILE_NAME = "SKILL.md";
export const SKILL_TOOL_FILES = ["tool.ts", "tool.js"] as const;

export function getGlobalSkillsDir(): string {
  return path.join(getUserConfigDir(), "agent", "skills");
}

export function getProfileSkillsDir(orgId: string, profileId: string): string {
  return path.join(getUserConfigDir(), "orgs", orgId, "profiles", profileId, "skills");
}

export async function resolveSkillDiscoveryDirs(options: {
  orgId?: string;
  profileId?: string;
} = {}): Promise<string[]> {
  const dirs = [getGlobalSkillsDir()];

  if (options.orgId && options.profileId) {
    dirs.push(getProfileSkillsDir(options.orgId, options.profileId));
    return [...new Set(dirs)];
  }

  const orgsDir = path.join(getUserConfigDir(), "orgs");

  if (!(await pathExists(orgsDir))) {
    return [...new Set(dirs)];
  }

  const orgEntries = await readdir(orgsDir, { withFileTypes: true });

  for (const orgEntry of orgEntries) {
    if (!orgEntry.isDirectory()) {
      continue;
    }

    const profilesDir = path.join(orgsDir, orgEntry.name, "profiles");

    if (!(await pathExists(profilesDir))) {
      continue;
    }

    const profileEntries = await readdir(profilesDir, { withFileTypes: true });

    for (const profileEntry of profileEntries) {
      if (profileEntry.isDirectory()) {
        dirs.push(getProfileSkillsDir(orgEntry.name, profileEntry.name));
      }
    }
  }

  return [...new Set(dirs)];
}
