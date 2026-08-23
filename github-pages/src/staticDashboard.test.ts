import { describe, expect, it } from "vitest";
import { createFundsCsv, createMarketsCsv, filterHistoryRange, isStaticDashboard, sortStaticFunds, staticDashboardUrl, type StaticFund } from "./staticDashboard";

describe("GitHub Pages 靜態資料契約", () => {
  it("依 Pages base path 產生公開 dashboard JSON 位置", () => {
    expect(staticDashboardUrl("/investment-dashboard-online/")).toBe("/investment-dashboard-online/data/dashboard.json");
    expect(staticDashboardUrl("/")).toBe("/data/dashboard.json");
  });

  it("拒絕不完整資料並接受最小公開 dashboard payload", () => {
    expect(isStaticDashboard({ markets: [], funds: [] })).toBe(false);
    expect(isStaticDashboard({ generatedAt: null, markets: [], funds: [], news: [], sourceHealth: [], errors: [] })).toBe(true);
  });

  it("依最近資料日期裁切區間，並可依年度報酬排序", () => {
    const history = [{ date: "2026-01-01", value: 10 }, { date: "2026-07-01", value: 12 }, { date: "2026-08-01", value: 13 }];
    expect(filterHistoryRange(history, "1m")).toEqual([{ date: "2026-07-01", value: 12 }, { date: "2026-08-01", value: 13 }]);
    const funds = [{ id: "b", name: "B", returns: { year: 5, month: 1 } }, { id: "a", name: "A", returns: { year: 12, month: -1 } }] as unknown as StaticFund[];
    expect(sortStaticFunds(funds, "year").map(fund => fund.id)).toEqual(["a", "b"]);
  });

  it("產生含中文欄名與安全引號跳脫的市場及基金 CSV", () => {
    const funds = [{ id: "fund-1", type: "domestic", name: "示範,基金", code: "=ABC", currency: "TWD", nav: 10.25, asOfDate: "2026-08-21", returns: { week: 1, month: 2, quarter: 3, halfYear: 4, year: 5 }, history: [] }] as StaticFund[];
    const fundCsv = createFundsCsv(funds);
    const marketCsv = createMarketsCsv([{ ticker: "^GSPC", name: "S&P 500", price: 6450.1, change: 12.3, percentChange: 0.19, quoteDate: "2026-08-21", history: [] }]);

    expect(fundCsv.startsWith("\uFEFF基金類型")).toBe(true);
    expect(fundCsv).toContain('"示範,基金"');
    expect(fundCsv).toContain("'=ABC");
    expect(fundCsv).toContain("國內基金");
    expect(marketCsv).toContain("市場名稱,代碼,最新價格");
    expect(marketCsv).toContain("S&P 500,^GSPC,6450.1");
  });
});
