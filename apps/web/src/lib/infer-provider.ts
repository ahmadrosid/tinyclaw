export type InferredProvider = "openai" | "anthropic";

export function inferProviderFromApiKey(apiKey: string): InferredProvider {
  if (apiKey.trim().startsWith("sk-ant-")) {
    return "anthropic";
  }

  return "openai";
}
