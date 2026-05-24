import {
  inferProviderFromApiKey,
  readEnvValue,
  type ProviderName,
  type UserProviderConfig,
} from "@tinyclaw/core";
import { getModelById } from "./models";

export function detectProvider(
  env: Record<string, string | undefined> = process.env,
  userConfig?: UserProviderConfig | null,
): ProviderName | null {
  if (readEnvValue(env, "OPENAI_API_KEY")) {
    return "openai";
  }

  if (readEnvValue(env, "ANTHROPIC_API_KEY")) {
    return "anthropic";
  }

  const apiKey = userConfig?.apiKey?.trim();

  if (!apiKey) {
    return null;
  }

  if (userConfig.model) {
    const option = getModelById(userConfig.model);

    if (option) {
      return option.provider;
    }
  }

  if (userConfig.provider) {
    return userConfig.provider;
  }

  return inferProviderFromApiKey(apiKey);
}
