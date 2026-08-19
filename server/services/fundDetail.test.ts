import { describe, expect, it } from "vitest";
import { buildPublicFundDetail } from "./fundDetail";

const history = [
  { date: "2025-08-14", nav: 10 },
  { date: "2026-02-14", nav: 12 },
  { date: "2026-07-14", nav: 13 },
  { date: "2026-08-07", nav: 14 },
  { date: "2026-08-14", nav: 15 },
];

describe("buildPublicFundDetail", () => {
  it("回傳完整歷史、五期比較與國內基金來源契約", () => {
    const detail = buildPublicFundDetail({ id: 7, name: "測試國內基金", code: "TEST07", fundType: "domestic", currency: "TWD", latestNav: 15, asOfDate: "2026-08-14", history, distributions: [{ exDate: "2026-08-07", amount: 1, annualizedYield: 2, payoutDate: "2026-08-20", sourceUrl: "https://example.com/dividend" }], lastSyncedAt: "2026-08-15" });
    expect(detail.history).toEqual(history);
    expect(detail.perf).toMatchObject({ week: 7.1429, halfYear: 25, year: 50 });
    expect(detail.totalReturn).toMatchObject({ available: true, method: "配息於除息日淨值再投入" });
    expect(detail.totalReturn.history.at(-1)?.nav).toBeGreaterThan(100);
    expect(detail.source).toMatchObject({ name: "MoneyDJ／合庫基金圖表資料", detail: "合庫基金國內基金圖表端點", endpoint: "https://fund.hncb.com.tw/w/bcd/tBCDNavList.djbcd" });
  });

  it("以歷史末筆補足最新淨值，並提供境外基金來源端點", () => {
    const detail = buildPublicFundDetail({ id: 8, name: "測試境外基金", code: "AU08", fundType: "foreign", currency: "USD", latestNav: null, asOfDate: null, history, lastSyncedAt: null });
    expect(detail.nav).toBe(15);
    expect(detail.asOfDate).toBe("2026-08-14");
    expect(detail.source).toMatchObject({ detail: "合庫基金境外基金圖表端點", endpoint: "https://fund.hncb.com.tw/w/bcd/BCDNavList.djbcd" });
    expect(detail.totalReturn).toMatchObject({ available: false, method: "目前公開來源未提供完整配息歷史" });
  });
});
