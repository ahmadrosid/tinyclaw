export type UserProviderName = "openai" | "anthropic";

export function inferProviderFromApiKey(apiKey: string): UserProviderName {
  if (apiKey.trim().startsWith("sk-ant-")) {
    return "anthropic";
  }

  return "openai";
}
