import { describe, expect, test } from "bun:test";
import { buildSuperBotFixDraft } from "./tool-playground-draft";

describe("tool playground draft", () => {
  test("includes tool name, parameters, and error", () => {
    const draft = buildSuperBotFixDraft({
      toolName: "fetch_data",
      parameters: { query: "test" },
      error: "API key missing",
    });

    expect(draft).toContain('tool "fetch_data"');
    expect(draft).toContain('"query": "test"');
    expect(draft).toContain("API key missing");
  });
});
