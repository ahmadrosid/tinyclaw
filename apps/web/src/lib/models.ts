import type { ProviderModelOption } from "@tinyclaw/core/contract";
import {
  inferProviderFromApiKey,
  type UserProviderName,
} from "@tinyclaw/core/provider-inference";

export type InferredProvider = UserProviderName;
export { inferProviderFromApiKey };

export function filterModelsByProvider(
  models: ProviderModelOption[],
  provider: InferredProvider | null | undefined,
): ProviderModelOption[] {
  if (!provider) {
    return models;
  }

  return models.filter((model) => model.provider === provider);
}

export function defaultModelForProvider(
  models: ProviderModelOption[],
  provider: InferredProvider,
): string {
  const providerModels = filterModelsByProvider(models, provider);
  return (
    providerModels.find((model) => model.default)?.id ??
    providerModels[0]?.id ??
    ""
  );
}

export function formatProviderLabel(provider: string | null | undefined): string {
  if (provider === "openai") {
    return "OpenAI";
  }

  if (provider === "anthropic") {
    return "Anthropic";
  }

  return provider ?? "Provider";
}

export const PROVIDER_OPTIONS: Array<{ id: InferredProvider; label: string }> = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
];

export function apiKeyPlaceholder(provider: InferredProvider): string {
  return provider === "anthropic" ? "sk-ant-…" : "sk-…";
}

export function apiKeyHint(provider: InferredProvider): string {
  return provider === "anthropic"
    ? "Anthropic API keys start with sk-ant-"
    : "OpenAI API keys start with sk-";
}

export function getModelDisplayName(
  models: ProviderModelOption[],
  modelId: string | null | undefined,
): string {
  if (!modelId) {
    return "Unknown";
  }

  return models.find((model) => model.id === modelId)?.name ?? modelId;
}

export function validateApiKeyForProvider(
  apiKey: string,
  provider: InferredProvider,
): string | null {
  const trimmed = apiKey.trim();

  if (!trimmed) {
    return "API key is required.";
  }

  const keyProvider = inferProviderFromApiKey(trimmed);

  if (keyProvider !== provider) {
    return `This looks like a ${formatProviderLabel(keyProvider)} key. Choose ${formatProviderLabel(keyProvider)} or paste a ${formatProviderLabel(provider)} key.`;
  }

  return null;
}
