import { join } from "node:path";
import {
  ensureDir,
  readTextIfExists,
  writePrivateTextFile,
  writePrivateTextFileIfMissing,
} from "./fs";
import { getUserConfigDir } from "./user-config";

const USER_TEMPLATE = `# About Me

How the agent should understand and help you.

---

## Basics

- Name / nickname:
- Role:

---

## Communication

- Preferred tone from the agent:
- Detail level (concise vs thorough):

---

## Work context

- Current projects:
- Tech stack:
- Priorities:

---

## Preferences

- Always:
- Never:
`;

export function getUserContextPath(): string {
  return join(getUserConfigDir(), "USER.md");
}

export async function loadUserContext(): Promise<string | undefined> {
  return readTextIfExists(getUserContextPath());
}

export async function getUserContextStatus(): Promise<{
  path: string;
  active: boolean;
  content?: string;
}> {
  const path = getUserContextPath();
  const content = await loadUserContext();

  return {
    path,
    active: content !== undefined,
    ...(content !== undefined ? { content } : {}),
  };
}

export async function writeUserContext(content: string): Promise<void> {
  await writePrivateTextFile(getUserContextPath(), content, {
    ensureDir: getUserConfigDir(),
  });
}

export interface InitUserContextResult {
  path: string;
  created: boolean;
}

export async function initUserContext(): Promise<InitUserContextResult> {
  const path = getUserContextPath();
  await ensureDir(getUserConfigDir());
  const created = await writePrivateTextFileIfMissing(path, USER_TEMPLATE);
  return { path, created };
}
