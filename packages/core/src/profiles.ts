import type { ProfileSummary } from "./contract";

export function pickProfileForOrg(
  profiles: ProfileSummary[],
  preferredProfileId?: string,
): ProfileSummary {
  if (preferredProfileId) {
    const match = profiles.find((profile) => profile.id === preferredProfileId);

    if (match) {
      return match;
    }
  }

  const defaultProfile = profiles.find((profile) => profile.isDefault);

  if (defaultProfile) {
    return defaultProfile;
  }

  if (profiles.length === 0) {
    throw new Error("No profiles are available.");
  }

  return profiles[0]!;
}
