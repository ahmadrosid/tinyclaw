import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ChatSessionRecord {
  sessionId: string;
  profileId: string;
  updatedAt: string;
}

type ChatSessionMap = Record<string, ChatSessionRecord>;

export class SessionStore {
  private readonly path: string;
  private map: ChatSessionMap = {};

  constructor(path = getChatSessionsPath()) {
    this.path = path;
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.path, "utf8");
      const parsed = JSON.parse(raw) as unknown;

      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        this.map = {};
        return;
      }

      this.map = parsed as ChatSessionMap;
    } catch {
      this.map = {};
    }
  }

  get(chatId: string): ChatSessionRecord | undefined {
    return this.map[chatId];
  }

  set(chatId: string, record: ChatSessionRecord): void {
    this.map[chatId] = record;
  }

  async save(): Promise<void> {
    const dir = getTelegramConfigDir();
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeFile(this.path, `${JSON.stringify(this.map, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await chmod(this.path, 0o600);
  }
}

export function getTelegramConfigDir(): string {
  return join(homedir(), ".tinyclaw", "telegram");
}

export function getChatSessionsPath(): string {
  return join(getTelegramConfigDir(), "chat-sessions.json");
}
