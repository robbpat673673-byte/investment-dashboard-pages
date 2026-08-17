import { describe, expect, it } from "vitest";
import { observatoryMessagesToMarkdown } from "./observatoryExport";

describe("observatory export", () => {
  it("supports distinct all-news and favorites-only citation inputs", () => {
    const base = [{ label: "市場行情", detail: "快照", url: "https://example.com/market" }];
    const allNews = [...base, { label: "來源 A", detail: "全部新聞標題", url: "https://example.com/all" }];
    const favoritesOnly = [...base, { label: "來源 B", detail: "收藏新聞標題", url: "https://example.com/favorite" }];
    const allMarkdown = observatoryMessagesToMarkdown([], new Date("2026-08-16T00:00:00.000Z"), { asOf: null, highlights: [] }, allNews);
    const favoritesMarkdown = observatoryMessagesToMarkdown([], new Date("2026-08-16T00:00:00.000Z"), { asOf: null, highlights: [] }, favoritesOnly);
    expect(allMarkdown).toContain("全部新聞標題");
    expect(allMarkdown).not.toContain("收藏新聞標題");
    expect(favoritesMarkdown).toContain("收藏新聞標題");
    expect(favoritesMarkdown).not.toContain("全部新聞標題");
  });

  it("renders user, system and assistant messages as Markdown", () => {
    const markdown = observatoryMessagesToMarkdown([
      { role: "system", content: "資料來源：Yahoo Finance" },
      { role: "user", content: "分析今日摘要" },
      { role: "assistant", content: "## 事實\n今日市場偏中性。" },
    ], new Date("2026-08-16T00:00:00.000Z"), { asOf: "2026-08-16T04:00:00.000Z", highlights: [{ ticker: "^TWII", name: "加權指數", price: 23100, percentChange: 0.42, quoteDate: "2026-08-16" }] }, [{ label: "Yahoo Finance", detail: "市場行情公開資料", url: "https://finance.yahoo.com/" }]);
    expect(markdown).toContain("## 系統脈絡");
    expect(markdown).toContain("## 當日市場快照");
    expect(markdown).toContain("加權指數（^TWII）");
    expect(markdown).toContain("## 引用來源");
    expect(markdown).toContain("https://finance.yahoo.com/");
    expect(markdown).toContain("## 提問");
    expect(markdown).toContain("分析今日摘要");
    expect(markdown).toContain("## 財經小智分析");
    expect(markdown).toContain("不構成個人化投資建議");
  });
});
