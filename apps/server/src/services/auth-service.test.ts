import { describe, expect, test, beforeEach } from "bun:test";
import { AuthService } from "./auth-service";
import type { DatabaseAdapter, StoredUserRecord } from "@tinyclaw/db";

const TEST_CONFIG = {
  jwtSecret: "test-secret-key-for-jwt-signing-1234567890",
  adminEmail: "admin@example.com",
  adminPassword: "testpassword123",
};

function createMockDb(initialUser: StoredUserRecord | null = null): DatabaseAdapter {
  const users = new Map<string, StoredUserRecord>();
  if (initialUser) {
    users.set(initialUser.email, initialUser);
  }

  return {
    getUserByEmail: async (email: string) => users.get(email) ?? null,
    createUser: async (record: StoredUserRecord) => {
      users.set(record.email, record);
    },
  } as unknown as DatabaseAdapter;
}

describe("AuthService", () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService(TEST_CONFIG);
  });

  describe("hashPassword", () => {
    test("returns a bcrypt hash", async () => {
      const hash = await authService.hashPassword("password123");
      expect(hash).toStartWith("$2");
      expect(hash.length).toBeGreaterThan(50);
    });

    test("different passwords produce different hashes", async () => {
      const hash1 = await authService.hashPassword("password1");
      const hash2 = await authService.hashPassword("password2");
      expect(hash1).not.toBe(hash2);
    });
  });

  describe("verifyPassword", () => {
    test("returns true for correct password", async () => {
      const hash = await authService.hashPassword("password123");
      const result = await authService.verifyPassword("password123", hash);
      expect(result).toBe(true);
    });

    test("returns false for incorrect password", async () => {
      const hash = await authService.hashPassword("password123");
      const result = await authService.verifyPassword("wrongpassword", hash);
      expect(result).toBe(false);
    });
  });

  describe("createToken and verifyToken", () => {
    test("creates a valid JWT token", async () => {
      const token = await authService.createToken("admin@example.com");
      const payload = await authService.verifyToken(token);
      expect(payload.email).toBe("admin@example.com");
    });

    test("rejects an invalid token", async () => {
      await expect(authService.verifyToken("invalid-token")).rejects.toThrow();
    });

    test("rejects a token signed with a different secret", async () => {
      const otherService = new AuthService({
        ...TEST_CONFIG,
        jwtSecret: "different-secret-key-12345678901234567890",
      });
      const token = await otherService.createToken("admin@example.com");
      await expect(authService.verifyToken(token)).rejects.toThrow();
    });
  });

  describe("seedUserIfNeeded", () => {
    test("creates user when table is empty", async () => {
      const db = createMockDb();
      await authService.seedUserIfNeeded(db);
      const user = await db.getUserByEmail(TEST_CONFIG.adminEmail);
      expect(user).not.toBeNull();
      expect(user?.email).toBe(TEST_CONFIG.adminEmail);
      expect(user?.passwordHash).toStartWith("$2");
    });

    test("does nothing when user already exists", async () => {
      const existingUser: StoredUserRecord = {
        id: "user_existing",
        email: TEST_CONFIG.adminEmail,
        passwordHash: "existing_hash",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };
      const db = createMockDb(existingUser);
      await authService.seedUserIfNeeded(db);
      const user = await db.getUserByEmail(TEST_CONFIG.adminEmail);
      expect(user?.passwordHash).toBe("existing_hash");
    });
  });
});
