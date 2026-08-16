import { describe, expect, it } from "vitest";
import { RSS_SOURCES } from "./dashboardRefresh";

describe("financial RSS sources", () => {
  it("keeps the verified multi-source feed set", () => {
    const labels = RSS_SOURCES.map(([, label]) => label);
    expect(labels).toEqual(expect.arrayContaining(["華爾街日報・市場", "CNBC・財經市場", "MarketWatch・焦點", "Financial Times・財經", "Google 新聞・台灣財經"]));
    expect(RSS_SOURCES.every(([url]) => url.startsWith("https://"))).toBe(true);
  });
});
