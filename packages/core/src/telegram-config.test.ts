import { describe, expect, test } from "bun:test";
import {
  generateHandshakeCode,
  isTelegramUserAuthorized,
  maskBotToken,
  normalizeHandshakeInput,
  parseAllowedUserIds,
} from "./telegram-config";

describe("parseAllowedUserIds", () => {
  test("parses comma-separated ids", () => {
    expect(parseAllowedUserIds("123, 456")).toEqual([123, 456]);
  });

  test("rejects invalid ids", () => {
    expect(() => parseAllowedUserIds("abc")).toThrow("Invalid Telegram user ID");
  });
});

describe("maskBotToken", () => {
  test("masks long tokens", () => {
    expect(maskBotToken("12345678901234567890")).toBe("••••••••••••7890");
  });

  test("returns null for empty", () => {
    expect(maskBotToken("")).toBeNull();
  });
});

describe("normalizeHandshakeInput", () => {
  test("strips spaces and uppercases", () => {
    expect(normalizeHandshakeInput(" ab cd12 ")).toBe("ABCD12");
  });
});

describe("isTelegramUserAuthorized", () => {
  test("accepts paired or allowlisted users", () => {
    expect(
      isTelegramUserAuthorized(1, { pairedUserIds: [1], allowedUserIds: [] }),
    ).toBe(true);
    expect(
      isTelegramUserAuthorized(2, { pairedUserIds: [], allowedUserIds: [2] }),
    ).toBe(true);
    expect(
      isTelegramUserAuthorized(3, { pairedUserIds: [], allowedUserIds: [] }),
    ).toBe(false);
  });
});

describe("generateHandshakeCode", () => {
  test("returns 8 uppercase hex chars", () => {
    expect(generateHandshakeCode()).toMatch(/^[0-9A-F]{8}$/);
  });
});
