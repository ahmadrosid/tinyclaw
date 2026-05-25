import { Bot } from "grammy";
import type { TelegramBridgeConfig } from "./config";
import { createChatHandler, type ChatHandlerDeps } from "./chat-handler";

export function createBot(
  config: TelegramBridgeConfig,
  deps: Omit<ChatHandlerDeps, "config">,
): Bot {
  const bot = new Bot(config.botToken);
  const handleMessage = createChatHandler({ ...deps, config });

  bot.on("message", handleMessage);

  bot.catch((error) => {
    console.error("Telegram bot error:", error);
  });

  return bot;
}
