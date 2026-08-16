import { describe, expect, it } from "vitest";
import { parseObservatoryChatHistory, serializeObservatoryChatHistory, upsertObservatoryChatSession } from "./observatoryChatHistory";

const user = { role: "user" as const, content: "分析今日摘要" };
const assistant = { role: "assistant" as const, content: "摘要日期：2026-08-16；來源：每日財經摘要" };

describe("observatory chat history", () => {
  it("safely parses malformed storage and round trips valid sessions", () => {
    expect(parseObservatoryChatHistory("bad-json")).toEqual([]);
    const sessions = upsertObservatoryChatSession([], [user, assistant], "", new Date("2026-08-16T01:00:00Z"));
    expect(parseObservatoryChatHistory(serializeObservatoryChatHistory(sessions))).toEqual(sessions);
  });

  it("updates the active session and keeps a bounded message list", () => {
    const first = upsertObservatoryChatSession([], [user], null, new Date("2026-08-16T01:00:00Z"));
    const updated = upsertObservatoryChatSession(first, [user, assistant], first[0].id, new Date("2026-08-16T02:00:00Z"));
    expect(updated).toHaveLength(1);
    expect(updated[0].messages).toEqual([user, assistant]);
    expect(updated[0].updatedAt).toBe("2026-08-16T02:00:00.000Z");
  });
});
