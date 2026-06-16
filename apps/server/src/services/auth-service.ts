import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { DatabaseAdapter, StoredUserRecord } from "@tinyclaw/db";

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY_DAYS = 7;

export interface AuthServiceConfig {
  jwtSecret: string;
  adminEmail: string;
  adminPassword: string;
}

export class AuthService {
  private readonly jwtSecret: Uint8Array;
  private readonly config: AuthServiceConfig;

  constructor(config: AuthServiceConfig) {
    this.config = config;
    this.jwtSecret = new TextEncoder().encode(config.jwtSecret);
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async createToken(email: string): Promise<string> {
    return new SignJWT({ email })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${TOKEN_EXPIRY_DAYS}d`)
      .sign(this.jwtSecret);
  }

  async verifyToken(token: string): Promise<{ email: string }> {
    const { payload } = await jwtVerify(token, this.jwtSecret, {
      clockTolerance: 60,
    });
    if (typeof payload.email !== "string") {
      throw new Error("Invalid token payload");
    }
    return { email: payload.email };
  }

  async seedUserIfNeeded(db: DatabaseAdapter): Promise<void> {
    const existing = await db.getUserByEmail(this.config.adminEmail);
    if (existing) {
      return;
    }

    const now = new Date().toISOString();
    const hash = await this.hashPassword(this.config.adminPassword);
    const user: StoredUserRecord = {
      id: "user_admin",
      email: this.config.adminEmail,
      passwordHash: hash,
      createdAt: now,
      updatedAt: now,
    };
    await db.createUser(user);
  }
}
