import { describe, expect, it } from "vitest";
import { appendObservatoryMessage, createObservatoryChatRequest, OBSERVATORY_CHAT_ERROR, OBSERVATORY_GREETING } from "./observatoryChat";

describe("observatoryChat", () => {
  it("保留使用者問題與成功回覆，並移除輸入兩端空白", () => {
    const afterQuestion = appendObservatoryMessage([{ role: "assistant", content: OBSERVATORY_GREETING }], "user", "  整理市場趨勢  ");
    const afterAnswer = appendObservatoryMessage(afterQuestion, "assistant", "  ## 事實\n來源：Yahoo Finance  ");

    expect(afterAnswer.at(-2)).toEqual({ role: "user", content: "整理市場趨勢" });
    expect(afterAnswer.at(-1)).toEqual({ role: "assistant", content: "## 事實\n來源：Yahoo Finance" });
  });

  it("失敗訊息可加入對話且空白輸入不會建立訊息", () => {
    const messages = appendObservatoryMessage([], "assistant", OBSERVATORY_CHAT_ERROR);
    expect(appendObservatoryMessage(messages, "user", "   ")).toEqual(messages);
    expect(messages[0]?.content).toBe(OBSERVATORY_CHAT_ERROR);
  });

  it("送往公開端點的對話只保留最近六則可顯示訊息", () => {
    const messages = Array.from({ length: 8 }, (_, index) => ({ role: index % 2 === 0 ? "user" as const : "assistant" as const, content: `訊息 ${index + 1}` }));
    const request = createObservatoryChatRequest(messages);
    expect(request).toHaveLength(6);
    expect(request[0]?.content).toBe("訊息 3");
    expect(request.at(-1)?.content).toBe("訊息 8");
  });
});
