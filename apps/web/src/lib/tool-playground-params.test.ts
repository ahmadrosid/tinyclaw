import { describe, expect, test } from "bun:test";
import { buildExampleParametersJson, exampleParametersFromSchema } from "./tool-playground-params";

describe("tool playground params", () => {
  test("builds example object from schema properties", () => {
    expect(
      exampleParametersFromSchema({
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "integer" },
          active: { type: "boolean" },
          mode: { type: "string", enum: ["fast", "slow"] },
        },
        required: ["query"],
      }),
    ).toEqual({
      query: "",
      limit: 0,
      active: false,
      mode: "fast",
    });
  });

  test("returns empty object without properties", () => {
    expect(buildExampleParametersJson({ type: "object", additionalProperties: true })).toBe("{}");
  });
});
