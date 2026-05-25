import { formatClientError } from "@tinyclaw/core/api-error";

const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;

export function formatError(error: unknown): string {
  return formatClientError(error);
}

export function splitTelegramMessage(text: string): string[] {
  if (text.length <= TELEGRAM_MAX_MESSAGE_LENGTH) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > TELEGRAM_MAX_MESSAGE_LENGTH) {
    let splitAt = remaining.lastIndexOf("\n", TELEGRAM_MAX_MESSAGE_LENGTH);

    if (splitAt <= 0) {
      splitAt = TELEGRAM_MAX_MESSAGE_LENGTH;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

export const HELP_TEXT = `TinyClaw Telegram commands:

/help — show this message
/clear — clear chat history
/new — start a new conversation
/status — server and model status

Send any other text to chat with the agent.`;
