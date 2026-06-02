import { getModelById } from "./models";

export interface ModelPricing {
  /** USD per 1M input tokens */
  inputPerMillionUsd: number;
  /** USD per 1M output tokens */
  outputPerMillionUsd: number;
}

const DEFAULT_PRICING: ModelPricing = {
  inputPerMillionUsd: 1,
  outputPerMillionUsd: 3,
};

export function getModelPricing(modelId: string): ModelPricing {
  const catalog = getModelById(modelId);
  if (catalog?.inputPerMillionUsd != null && catalog.outputPerMillionUsd != null) {
    return {
      inputPerMillionUsd: catalog.inputPerMillionUsd,
      outputPerMillionUsd: catalog.outputPerMillionUsd,
    };
  }

  return DEFAULT_PRICING;
}

export function estimateUsageCostUsd(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = getModelPricing(modelId);
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillionUsd;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillionUsd;
  return inputCost + outputCost;
}

export function hasCatalogPricing(modelId: string): boolean {
  const catalog = getModelById(modelId);
  return catalog?.inputPerMillionUsd != null && catalog.outputPerMillionUsd != null;
}
