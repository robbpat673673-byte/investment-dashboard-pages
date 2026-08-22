import { describe, expect, it } from "vitest";
import { filterHistoryRange, isStaticDashboard, sortStaticFunds, staticDashboardUrl, type StaticFund } from "./staticDashboard";

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
});
