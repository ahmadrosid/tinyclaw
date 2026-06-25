import { describe, expect, test } from "bun:test";
import type { ProviderClient } from "@tinyclaw/core";
import { createInMemoryDatabaseAdapter } from "@tinyclaw/db";
import { LlmUsageTracker } from "../services/llm-usage-tracker";
import { wrapProviderWithUsageTracking } from "./usage-tracking";

describe("usage tracking", () => {
  test("prefers provider-reported usage for chat calls", async () => {
    const tracker = await LlmUsageTracker.create(createInMemoryDatabaseAdapter());
    const provider: ProviderClient = {
      name: "openai",
      async generateText() {
        return "unused";
      },
      async generateChat() {
        return {
          content: "Hello",
          toolCalls: [],
          assistantMessage: { role: "assistant", content: "Hello" },
          usage: { inputTokens: 123, outputTokens: 45, totalTokens: 168 },
        };
      },
      async streamChat() {
        return {
          content: "Hello",
          toolCalls: [],
          assistantMessage: { role: "assistant", content: "Hello" },
          usage: { inputTokens: 123, outputTokens: 45, totalTokens: 168 },
        };
      },
    };

    const wrapped = wrapProviderWithUsageTracking(provider, tracker, "gpt-4o");
    await wrapped.generateChat({
      system: "system",
      messages: [{ role: "user", content: "hi" }],
    });

    expect(tracker.getStats()).toMatchObject({
      requestCount: 1,
      inputTokens: 123,
      outputTokens: 45,
      totalTokens: 168,
    });
  });
});
