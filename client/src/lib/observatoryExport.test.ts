import { describe, expect, it } from "vitest";
import { observatoryMessagesToMarkdown } from "./observatoryExport";

describe("observatory export", () => {
  it("renders user, system and assistant messages as Markdown", () => {
    const markdown = observatoryMessagesToMarkdown([
      { role: "system", content: "資料來源：Yahoo Finance" },
      { role: "user", content: "分析今日摘要" },
      { role: "assistant", content: "## 事實\n今日市場偏中性。" },
    ], new Date("2026-08-16T00:00:00.000Z"));
    expect(markdown).toContain("## 系統脈絡");
    expect(markdown).toContain("## 提問");
    expect(markdown).toContain("分析今日摘要");
    expect(markdown).toContain("## 財經小智分析");
    expect(markdown).toContain("不構成個人化投資建議");
  });
});
