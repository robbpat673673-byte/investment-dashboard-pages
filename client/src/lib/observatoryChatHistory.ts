import type { Message } from "@/components/AIChatBox";

export const OBSERVATORY_CHAT_HISTORY_KEY = "investment-dashboard-observatory-chat-history";
export const MAX_OBSERVATORY_CHAT_SESSIONS = 12;

export type ObservatoryChatSession = {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  messages: Message[];
};

export function parseObservatoryChatHistory(raw: string | null): ObservatoryChatSession[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSession).slice(0, MAX_OBSERVATORY_CHAT_SESSIONS);
  } catch {
    return [];
  }
}

function isSession(value: unknown): value is ObservatoryChatSession {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ObservatoryChatSession>;
  return typeof candidate.id === "string" && typeof candidate.createdAt === "string" && typeof candidate.updatedAt === "string" && typeof candidate.title === "string" && Array.isArray(candidate.messages);
}

export function serializeObservatoryChatHistory(sessions: ObservatoryChatSession[]) {
  return JSON.stringify(sessions.slice(0, MAX_OBSERVATORY_CHAT_SESSIONS));
}

export function upsertObservatoryChatSession(sessions: ObservatoryChatSession[], messages: Message[], activeId: string | null = null, now = new Date()) {
  const userMessage = messages.find(message => message.role === "user");
  if (!userMessage) return sessions;
  const timestamp = now.toISOString();
  const existing = activeId ? sessions.find(session => session.id === activeId) : undefined;
  const session: ObservatoryChatSession = {
    id: existing?.id ?? `${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    title: existing?.title ?? userMessage.content.slice(0, 42),
    messages: messages.slice(-24),
  };
  return [session, ...sessions.filter(item => item.id !== session.id)].slice(0, MAX_OBSERVATORY_CHAT_SESSIONS);
}
