import { describe, expect, test } from "bun:test";
import { createInMemoryDatabaseAdapter } from "@tinyclaw/db";
import { AutomationScheduler } from "./automation-scheduler";
import { AutomationService } from "./automation-service";
import { AutomationRunner } from "./automation-runner";

const ORG_ID = "org_test";
const PROFILE_ID = "profile_default";

describe("AutomationScheduler", () => {
  test("reload registers jobs for enabled scheduled automations", async () => {
    const db = createInMemoryDatabaseAdapter();
    const now = new Date().toISOString();

    await db.upsertOrganization({
      id: ORG_ID,
      name: "Test Org",
      slug: "test-org",
      createdAt: now,
      updatedAt: now,
    });

    await db.upsertProfile({
      id: PROFILE_ID,
      name: "Default Bot",
      systemPrompt: "",
      model: null,
      isSuper: false,
      orgId: ORG_ID,
      isDefault: true,
      createdAt: now,
      updatedAt: now,
    });

    const service = new AutomationService(db, {
      getUserTimezone: async () => "UTC",
    });

    const automation = await service.create(
      ORG_ID,
      {
        name: "Hourly",
        description: "Ping",
        prompt: "Ping",
        trigger: { type: "schedule", cron: "0 * * * *", timezone: "UTC" },
      },
      PROFILE_ID,
    );

    const runner = {
      run: async () => ({ output: "ok" }),
    };

    const scheduler = new AutomationScheduler(
      service,
      runner as unknown as AutomationRunner,
      async () => "UTC",
    );

    await scheduler.start();
    expect(scheduler.getStatus()).toEqual({ running: true, scheduledJobs: 1 });

    await service.update(automation.id, ORG_ID, { enabled: false });
    await scheduler.reload();
    expect(scheduler.getStatus()).toEqual({ running: true, scheduledJobs: 0 });

    scheduler.stop();
    expect(scheduler.getStatus()).toEqual({ running: false, scheduledJobs: 0 });
  });
});
