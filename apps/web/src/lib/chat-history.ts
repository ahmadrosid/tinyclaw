import type { ChatMessage } from "@tinyclaw/core/contract";

export interface RequestedChatSession {
  profileId: string;
  sessionId: string;
}

export interface ChatListItem {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  streaming?: boolean;
  toolCallId?: string;
  tool?: string;
  toolStatus?: "running" | "done";
  toolInput?: Record<string, unknown>;
  toolResult?: unknown;
}

export function sessionStorageKey(profileId: string): string {
  return `tinyclaw:session:${profileId}`;
}

function parseToolResult(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    return content;
  }
}

export function chatMessagesToListItems(messages: ChatMessage[]): ChatListItem[] {
  const toolInputs = new Map<string, Record<string, unknown>>();

  for (const message of messages) {
    if (message.role !== "assistant") {
      continue;
    }

    for (const call of message.toolCalls ?? []) {
      toolInputs.set(call.id, call.arguments);
    }
  }

  const items: ChatListItem[] = [];

  for (const [index, message] of messages.entries()) {
    if (message.role === "user") {
      items.push({
        id: `history-${index}`,
        role: "user",
        content: message.content,
      });
      continue;
    }

    if (message.role === "assistant") {
      if (!message.content.trim() && message.toolCalls?.length) {
        continue;
      }

      items.push({
        id: `history-${index}`,
        role: "assistant",
        content: message.content,
      });
      continue;
    }

    if (message.role === "tool") {
      items.push({
        id: message.toolCallId,
        role: "tool",
        content: `${message.name} completed`,
        toolCallId: message.toolCallId,
        tool: message.name,
        toolStatus: "done",
        toolInput: toolInputs.get(message.toolCallId),
        toolResult: parseToolResult(message.content),
      });
    }
  }

  return items;
}

export function formatSessionTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatSessionRelativeTime(value: string): string {
  return formatRelativeTime(value, "past");
}

export function formatFutureRelativeTime(value: string): string {
  return formatRelativeTime(value, "future");
}

function formatRelativeTime(value: string, tense: "past" | "future"): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const deltaMs =
    tense === "future" ? date.getTime() - Date.now() : Date.now() - date.getTime();

  if (tense === "future" && deltaMs <= 0) {
    return formatSessionTimestamp(value);
  }

  const seconds = Math.max(0, Math.round(deltaMs / 1000));

  if (seconds < 60) {
    return tense === "future" ? "in less than a minute" : "just now";
  }

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return tense === "future" ? `in ${minutes}m` : `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return tense === "future" ? `in ${hours}h` : `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  if (days < 7) {
    return tense === "future" ? `in ${days}d` : `${days}d ago`;
  }

  return formatSessionTimestamp(value);
}
