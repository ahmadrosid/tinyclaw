import { describe, expect, test } from "bun:test";
import { BASH_TOOL_ID, BUILTIN_TOOL_IDS, isProtectedToolId } from "./protected";

describe("isProtectedToolId", () => {
  test("returns true for built-in and bash tool ids", () => {
    for (const toolId of Object.values(BUILTIN_TOOL_IDS)) {
      expect(isProtectedToolId(toolId)).toBe(true);
    }

    expect(isProtectedToolId(BASH_TOOL_ID)).toBe(true);
  });

  test("returns false for agent-authored tool ids", () => {
    expect(isProtectedToolId("tool_custom_search")).toBe(false);
  });
});
