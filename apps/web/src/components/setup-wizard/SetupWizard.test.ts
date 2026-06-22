import { describe, expect, test } from "bun:test";
import { SETUP_STEPS } from "./SetupWizard";

describe("SETUP_STEPS", () => {
  test("keeps the setup flow in the expected order", () => {
    expect(SETUP_STEPS.map((step) => step.label)).toEqual([
      "Account",
      "Organization",
      "Provider",
      "About You",
      "Telegram",
      "WhatsApp",
    ]);
  });

  test("marks the required onboarding steps explicitly", () => {
    expect(SETUP_STEPS.filter((step) => step.required).map((step) => step.label)).toEqual([
      "Account",
      "Organization",
      "Provider",
    ]);
  });
});
