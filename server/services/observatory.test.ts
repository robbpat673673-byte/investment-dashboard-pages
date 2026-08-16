import { describe, expect, it } from "vitest";
import { buildObservatorySnapshot, dailySummarySystemPrompt, summaryDateTaipei } from "./observatory";

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

  it("將匯率、美元指數與公債殖利率納入觀測站重點行情與上下文", () => {
    const snapshot = buildObservatorySnapshot([
      { ticker: "TWD=X", name: "美元兌台幣", price: 32.1, percentChange: 0.2, quoteDate: "2026-08-16" },
      { ticker: "DX-Y.NYB", name: "美元指數", price: 101.2, percentChange: -0.1, quoteDate: "2026-08-16" },
      { ticker: "^TNX", name: "美國 10 年期公債殖利率", price: 4.2, percentChange: 0.3, quoteDate: "2026-08-16" },
    ], [], "2026-08-16T12:00:00.000Z");
    expect(snapshot.highlights.map(item => item.ticker)).toEqual(["TWD=X", "DX-Y.NYB", "^TNX"]);
    expect(snapshot.context).toContain("美元兌台幣");
    expect(snapshot.context).toContain("美國 10 年期公債殖利率");
  });

  it("每日摘要提示詞要求事實、觀察與限制並禁止捏造", () => {
    const prompt = dailySummarySystemPrompt("美元指數：101.2，資料時間：2026-08-16");
    expect(prompt).toContain("## 今日事實");
    expect(prompt).toContain("## 市場觀察");
    expect(prompt).toContain("## 限制與風險");
    expect(prompt).toContain("不可捏造");
  });

  it("摘要日期以台北時區產生 YYYY-MM-DD", () => {
    expect(summaryDateTaipei(new Date("2026-08-15T16:30:00.000Z"))).toBe("2026-08-16");
  });
});
