import { describe, expect, test } from "bun:test";
import { getProfileSoulDir } from "../soul/resolve";
import { buildToolExecutionContext } from "./context";

describe("buildToolExecutionContext", () => {
  test("adds profile workspace root when org and profile are set", () => {
    const context = buildToolExecutionContext({
      orgId: "org_1",
      profileId: "profile_1",
    });

    expect(context.workspaceRoot).toBe(getProfileSoulDir("org_1", "profile_1"));
  });

  test("preserves an explicit workspace root", () => {
    const context = buildToolExecutionContext({
      orgId: "org_1",
      profileId: "profile_1",
      workspaceRoot: "/tmp/custom-workspace",
    });

    expect(context.workspaceRoot).toBe("/tmp/custom-workspace");
  });
});
