import { describe, expect, test } from "bun:test";
import type { ChatMessage } from "@tinyclaw/core";
import { toAnthropicMessages } from "./anthropic-web-search";
import { toOpenAIMessages } from "./openai";
import { toResponsesInput } from "./openai-responses";

const tinyPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const multimodalUserMessage: ChatMessage = {
  role: "user",
  content: [
    { type: "text", text: "What is this?" },
    { type: "image", mediaType: "image/png", data: tinyPngBase64 },
  ],
};

describe("provider user content mapping", () => {
  test("toAnthropicMessages maps image parts", () => {
    const result = toAnthropicMessages([multimodalUserMessage]);
    const user = result[0];

    expect(user?.role).toBe("user");
    expect(Array.isArray(user?.content)).toBe(true);

    const blocks = user?.content as Array<Record<string, unknown>>;
    expect(blocks[0]).toEqual({ type: "text", text: "What is this?" });
    expect(blocks[1]).toEqual({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: tinyPngBase64,
      },
    });
  });

  test("toOpenAIMessages maps image parts", () => {
    const result = toOpenAIMessages("system", [multimodalUserMessage]);
    const user = result.find((message) => message.role === "user");

    expect(Array.isArray(user?.content)).toBe(true);

    const parts = user?.content as Array<Record<string, unknown>>;
    expect(parts[0]).toEqual({ type: "text", text: "What is this?" });
    expect(parts[1]?.type).toBe("image_url");
    expect((parts[1]?.image_url as { url: string }).url).toStartWith(
      "data:image/png;base64,",
    );
  });

  test("toResponsesInput maps image parts", () => {
    const result = toResponsesInput([multimodalUserMessage]);
    const user = result[0] as {
      type?: string;
      role: string;
      content: Array<Record<string, unknown>>;
    };

    expect(user.type).toBe("message");
    expect(user.role).toBe("user");
    expect(user.content[0]).toEqual({ type: "input_text", text: "What is this?" });
    expect(user.content[1]?.type).toBe("input_image");
    expect(user.content[1]?.image_url).toStartWith("data:image/png;base64,");
  });

  test("toResponsesInput aligns function_call ids with tool outputs", () => {
    const result = toResponsesInput([
      { role: "user", content: "run my digest" },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "call_tool_id",
            name: "run_automation",
            arguments: { automationId: "automation_1" },
          },
        ],
        providerContent: [
          {
            type: "function_call",
            id: "fc_internal_id",
            call_id: "fc_internal_id",
            name: "run_automation",
            arguments: '{"automationId":"automation_1"}',
          },
        ],
      },
      {
        role: "tool",
        toolCallId: "call_tool_id",
        name: "run_automation",
        content: '{"status":"completed","output":"done"}',
      },
    ]) as Array<Record<string, unknown>>;

    expect(result).toEqual([
      { role: "user", content: "run my digest" },
      {
        type: "function_call",
        call_id: "call_tool_id",
        name: "run_automation",
        arguments: '{"automationId":"automation_1"}',
      },
      {
        type: "function_call_output",
        call_id: "call_tool_id",
        output: '{"status":"completed","output":"done"}',
      },
    ]);
  });
});
