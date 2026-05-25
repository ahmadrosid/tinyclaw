import { createClient } from "@tinyclaw/client";
import { ensureServerRunning, stopSpawnedServer } from "@tinyclaw/core/ensure-server";
import { TelegramAuthStore } from "./auth-store";
import { createBot } from "./bot";
import { loadConfig } from "./config";
import { SessionStore } from "./session-store";

let spawnedChild: Bun.Subprocess | null = null;
let botStop: (() => void) | null = null;

registerCleanupHandlers(() => {
  botStop?.();
  stopSpawnedServer(spawnedChild);
});

try {
  const config = await loadConfig();
  const { serverUrl, spawnedChild: child } = await ensureServerRunning();
  spawnedChild = child;

  const client = createClient({ baseUrl: serverUrl });
  const health = await client.health();

  if (!health.providerConfigured) {
    console.warn(
      "Server has no provider configured. Chat runs in offline mode until an API key is set.",
    );
  }

  const sessionStore = new SessionStore();
  await sessionStore.load();

  const authStore = new TelegramAuthStore();
  await authStore.reload();

  const bot = createBot(config, { client, sessionStore, authStore });

  console.log("TinyClaw Telegram bridge running (long polling).");
  console.log(`Server: ${serverUrl}`);
  console.log(`Profile: ${config.profileId}`);
  const authConfig = authStore.getConfig();
  const paired = authConfig?.pairedUserIds.length ?? 0;
  const pendingHandshake = authConfig?.handshakeCode ? "yes" : "no";
  console.log(`Paired users: ${paired} · Pending handshake: ${pendingHandshake}`);

  botStop = () => bot.stop();

  await bot.start({
    onStart: (info) => {
      console.log(`Bot @${info.username} is listening.`);
    },
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
} finally {
  stopSpawnedServer(spawnedChild);
}

function registerCleanupHandlers(cleanup: () => void): void {
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
    process.on(signal, () => {
      cleanup();
      process.exit(0);
    });
  }
}
