import { describe, expect, test } from "bun:test";
import {
  buildChatPath,
  chatProfileIdFromPath,
  parseChatRouteParams,
  readRequestedProfileFromNewChatSearch,
  sessionStorageKey,
} from "./chat-history";

describe("chat history route helpers", () => {
  test("builds and parses chat routes consistently", () => {
    expect(buildChatPath("profile 1", "session/2")).toBe("/chat/profile%201/session%2F2");
    expect(chatProfileIdFromPath("/chat/profile%201/session%2F2")).toBe("profile 1");
    expect(parseChatRouteParams({ profileId: "p", sessionId: "s" })).toEqual({
      profileId: "p",
      sessionId: "s",
    });
    expect(parseChatRouteParams({ profileId: "", sessionId: "s" })).toBeNull();
  });

  test("reads the requested profile only for new chat links", () => {
    expect(readRequestedProfileFromNewChatSearch("?new=1&profile=default")).toBe("default");
    expect(readRequestedProfileFromNewChatSearch("?profile=default")).toBeNull();
  });

  test("uses a profile-scoped session storage key", () => {
    expect(sessionStorageKey("default")).toBe("tinyclaw:session:default");
  });
});
