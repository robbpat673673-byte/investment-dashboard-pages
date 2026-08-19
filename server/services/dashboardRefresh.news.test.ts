import { describe, expect, it } from "vitest";
import { isFreshNewsDate, RSS_MAX_AGE_MS, RSS_PER_SOURCE_QUOTA, RSS_SOURCES } from "./dashboardRefresh";

describe("financial RSS sources", () => {
  it("keeps the verified multi-source feed set", () => {
    const labels = RSS_SOURCES.map(([, label]) => label);
    expect(labels).toEqual(expect.arrayContaining(["華爾街日報・市場", "CNBC・財經市場", "MarketWatch・焦點", "Financial Times・財經", "Google 新聞・台灣財經"]));
    expect(RSS_SOURCES.every(([url]) => url.startsWith("https://"))).toBe(true);
    expect(RSS_PER_SOURCE_QUOTA).toBe(4);
  });

  it("排除超過七天、無效與未來日期的新聞", () => {
    const now = new Date("2026-08-19T00:00:00.000Z");
    expect(isFreshNewsDate(new Date("2026-08-18T23:00:00.000Z"), now)).toBe(true);
    expect(isFreshNewsDate(new Date(now.getTime() - RSS_MAX_AGE_MS - 1), now)).toBe(false);
    expect(isFreshNewsDate(new Date("invalid"), now)).toBe(false);
    expect(isFreshNewsDate(new Date("2026-08-19T00:00:01.000Z"), now)).toBe(false);
  });
});
