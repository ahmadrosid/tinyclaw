import { describe, expect, it } from "bun:test";
import { parseMcpToolParameters } from "./mcp-tool-schema";

describe("parseMcpToolParameters", () => {
  it("returns an empty list for invalid schemas", () => {
    expect(parseMcpToolParameters(null)).toEqual([]);
    expect(parseMcpToolParameters("invalid")).toEqual([]);
    expect(parseMcpToolParameters({})).toEqual([]);
  });

  it("extracts parameter metadata from JSON schema objects", () => {
    expect(
      parseMcpToolParameters({
        type: "object",
        required: ["path"],
        properties: {
          path: {
            type: "string",
            description: "File path to read",
          },
          encoding: {
            type: ["string", "null"],
            description: "Optional text encoding",
          },
        },
      }),
    ).toEqual([
      {
        name: "path",
        type: "string",
        description: "File path to read",
        required: true,
      },
      {
        name: "encoding",
        type: "string | null",
        description: "Optional text encoding",
        required: false,
      },
    ]);
  });
});
