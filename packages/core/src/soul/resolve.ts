import { join } from "node:path";
import { getUserConfigDir } from "../user-config";
import { getSoulStatus, loadSoulStack } from "./load";
import type { LoadedSoulStack, SoulStatus } from "./types";

/** Per-profile soul stack: ~/.tinyclaw/profiles/{profileId}/ */
export function getProfileSoulDir(profileId: string): string {
  return join(getUserConfigDir(), "profiles", profileId);
}

export async function resolveSoulStackForProfile(
  profileId: string,
): Promise<LoadedSoulStack | null> {
  const stack = await loadSoulStack(getProfileSoulDir(profileId));
  return stack.loaded.length > 0 ? stack : null;
}

export async function getResolvedSoulStatus(profileId: string): Promise<SoulStatus> {
  return getSoulStatus(getProfileSoulDir(profileId));
}
