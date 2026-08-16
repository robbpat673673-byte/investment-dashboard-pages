import { describe, expect, it } from "vitest";
import { buildObservatorySnapshot } from "./observatory";

describe("buildObservatorySnapshot", () => {
  it("以既有行情與新聞資料產生可追溯的市場廣度與焦點清單", () => {
    const snapshot = buildObservatorySnapshot([
      { ticker: "^TWII", name: "加權指數", price: 23100, percentChange: 0.85, quoteDate: "2026-08-16" },
      { ticker: "^GSPC", name: "S&P 500", price: 6400, percentChange: -0.24, quoteDate: "2026-08-15" },
      { ticker: "GC=F", name: "黃金期貨", price: 4380, percentChange: 0, quoteDate: "2026-08-15" },
    ], [{ title: "市場焦點新聞", source: "Google 新聞・全球市場", url: "https://example.com/news", publishedAt: "2026-08-16T01:00:00.000Z" }], "2026-08-16T12:00:00.000Z");

    expect(snapshot.pulse).toBe("中性");
    expect(snapshot.breadth).toEqual({ upCount: 1, downCount: 1, flatCount: 1, total: 3 });
    expect(snapshot.highlights.map(item => item.ticker)).toEqual(["^TWII", "^GSPC", "GC=F"]);
    expect(snapshot.headlines[0]?.source).toBe("Google 新聞・全球市場");
    expect(snapshot.context).toContain("市場焦點新聞");
    expect(snapshot.sources[0]?.url).toBe("https://finance.yahoo.com/");
  });

  it("在沒有可判讀漲跌幅時維持中性且不捏造市場方向", () => {
    const snapshot = buildObservatorySnapshot([{ ticker: "^DJI", name: "道瓊指數", price: null, percentChange: null, quoteDate: null }], [], null);
    expect(snapshot.pulse).toBe("中性");
    expect(snapshot.breadth.total).toBe(0);
    expect(snapshot.context).toContain("資料不足");
  });
});
