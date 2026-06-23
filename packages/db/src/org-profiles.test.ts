import { describe, expect, test } from "bun:test";
import { createInMemoryDatabaseAdapter } from "./adapters/in-memory";
import { seedOrgDefaultProfile } from "./org-profiles";

describe("seedOrgDefaultProfile", () => {
  test("creates one default profile per org", async () => {
    const db = createInMemoryDatabaseAdapter();

    const orgAProfile = await seedOrgDefaultProfile(db, "org_a");
    const orgBProfile = await seedOrgDefaultProfile(db, "org_b");

    expect(orgAProfile.orgId).toBe("org_a");
    expect(orgBProfile.orgId).toBe("org_b");
    expect(orgAProfile.id).not.toBe(orgBProfile.id);
    expect(orgAProfile.isDefault).toBe(true);
    expect(orgBProfile.isDefault).toBe(true);

    const orgAList = await db.listProfilesForOrg("org_a");
    const orgBList = await db.listProfilesForOrg("org_b");

    expect(orgAList).toHaveLength(1);
    expect(orgBList).toHaveLength(1);
    expect(orgAList[0]?.id).toBe(orgAProfile.id);
    expect(orgBList[0]?.id).toBe(orgBProfile.id);
  });

  test("is idempotent for the same org", async () => {
    const db = createInMemoryDatabaseAdapter();
    const first = await seedOrgDefaultProfile(db, "org_a");
    const second = await seedOrgDefaultProfile(db, "org_a");

    expect(second.id).toBe(first.id);
    expect(await db.listProfilesForOrg("org_a")).toHaveLength(1);
  });
});
