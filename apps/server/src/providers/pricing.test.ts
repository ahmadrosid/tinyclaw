import { describe, expect, test } from "bun:test";
import { estimateUsageCostUsd, getModelPricing } from "./pricing";

describe("estimateUsageCostUsd", () => {
  test("computes cost from catalog pricing", () => {
    const cost = estimateUsageCostUsd("claude-sonnet-4-6", 1_000_000, 1_000_000);
    expect(cost).toBe(18);
  });

  test("uses fallback pricing for unknown models", () => {
    const pricing = getModelPricing("vendor/custom-model");
    expect(pricing.inputPerMillionUsd).toBe(1);
    expect(pricing.outputPerMillionUsd).toBe(3);
  });
});
