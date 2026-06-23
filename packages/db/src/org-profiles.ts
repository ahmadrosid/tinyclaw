import { nanoid } from "@tinyclaw/core";
import { BASH_TOOL_ID, BUILTIN_TOOL_IDS } from "@tinyclaw/core/tools/protected";
import type { DatabaseAdapter, StoredProfileRecord } from "./types";

const DEFAULT_BUILTIN_TOOL_IDS = Object.values(BUILTIN_TOOL_IDS).filter(
  (toolId) => toolId !== BUILTIN_TOOL_IDS.create_skill,
);

export async function seedOrgDefaultProfile(
  db: DatabaseAdapter,
  orgId: string,
): Promise<StoredProfileRecord> {
  const existing = await db.getDefaultProfileForOrg(orgId);

  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const profile: StoredProfileRecord = {
    id: nanoid(),
    name: "Default Bot",
    systemPrompt: "You are a helpful personal assistant.",
    model: null,
    isSuper: false,
    orgId,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
  };

  await db.upsertProfile(profile);

  for (const toolId of DEFAULT_BUILTIN_TOOL_IDS) {
    await db.assignToolToProfile(profile.id, toolId);
  }

  return profile;
}

export async function ensureSuperBotBashTool(db: DatabaseAdapter, profileId: string): Promise<void> {
  const now = new Date().toISOString();
  const existing = await db.getTool(BASH_TOOL_ID);

  await db.upsertTool({
    id: BASH_TOOL_ID,
    name: "bash",
    description:
      "Run a shell command and return stdout, stderr, and exit code. Super Bot only.",
    handlerType: "bash",
    handlerConfig: {},
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  await db.assignToolToProfile(profileId, BASH_TOOL_ID);
}
