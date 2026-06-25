import type { AutomationSchedule } from "@tinyclaw/core";
import { errorResponse, json } from "../shared";
import type { HonoApp } from "../types";
import type { ServerOptions } from "../context";

export function registerInternalAutomationRoutes(app: HonoApp, options: ServerOptions): void {
  const { agent, automationService } = options;

  app.get("/v1/internal/automations/schedules", async (c) => {
    const auth = c.get("auth");
    if (!auth || auth.mode !== "local-token") {
      return errorResponse("Authentication required", 401);
    }

    const automations = await automationService.listAll();
    const schedules: AutomationSchedule[] = automations
      .filter((automation) => automation.enabled && automation.trigger.type === "schedule")
      .map((automation) => ({
        id: automation.id,
        cron: automation.trigger.cron,
        timezone: automation.trigger.timezone ?? null,
        orgId: automation.orgId,
        profileId: automation.profileId,
      }));

    return json(schedules);
  });

  app.post("/v1/internal/automations/:automationId/run", async (c) => {
    const auth = c.get("auth");
    if (!auth || auth.mode !== "local-token") {
      return errorResponse("Authentication required", 401);
    }

    const automationId = decodeURIComponent(c.req.param("automationId"));
    const automation = await automationService.get(automationId);

    if (!automation) {
      return errorResponse("Automation not found", 404);
    }

    const result = await agent.runAutomation(automationId);

    console.log(
      `[automation-worker] run automation=${automationId} org=${automation.orgId} profile=${automation.profileId} skipped=${result.skipped ?? false}`,
    );

    if (result.skipped) {
      return errorResponse(result.error ?? "Automation run skipped.", 409);
    }

    return new Response(null, { status: 204 });
  });
}
