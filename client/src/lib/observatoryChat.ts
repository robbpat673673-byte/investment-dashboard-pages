import type { Message } from "@/components/AIChatBox";

export const OBSERVATORY_GREETING = "您好，我是 **財經小智**。我會根據此頁已更新的市場行情與財經新聞，整理事實、觀察與風險限制；不提供保證報酬或個人化買賣指令。";
export const OBSERVATORY_CHAT_ERROR = "目前無法產生觀測回覆。請稍後再試，或先查看本頁資料快照與原始新聞連結。";

export function appendObservatoryMessage(messages: Message[], role: "user" | "assistant", content: string): Message[] {
  const normalized = content.trim();
  return normalized ? [...messages, { role, content: normalized }] : messages;
}

export function createObservatoryChatRequest(messages: Message[]) {
  return messages
    .filter(message => message.role === "user" || message.role === "assistant")
    .slice(-6)
    .map(message => ({ role: message.role as "user" | "assistant", content: message.content }));
}
