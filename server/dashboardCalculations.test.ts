import { describe, expect, it } from "vitest";
import { calculatePerformances, cleanText, parseHistoryPayload, safeUrl, sampleHistory } from "./services/dashboardCalculations";

describe("基金歷史淨值與新聞資料處理", () => {
  it("解析 MoneyDJ 圖表日期與淨值序列", () => {
    expect(parseHistoryPayload("20250102,20250103 10.0,10.5")).toEqual([
      { date: "2025-01-02", nav: 10 },
      { date: "2025-01-03", nav: 10.5 },
    ]);
  });

  it("以目標日期之前最近可得淨值計算五個期間報酬", () => {
    const history = [
      { date: "2024-08-14", nav: 10 },
      { date: "2025-02-14", nav: 12 },
      { date: "2025-05-14", nav: 13 },
      { date: "2025-07-14", nav: 14 },
      { date: "2025-08-07", nav: 15 },
      { date: "2025-08-14", nav: 16 },
    ];
    expect(calculatePerformances(history)).toEqual({ week: 6.6667, month: 14.2857, quarter: 23.0769, halfYear: 33.3333, year: 60 });
  });

  it("移除 RSS HTML 並只接受安全的 HTTP(S) 連結", () => {
    expect(cleanText("<![CDATA[<b>財經</b>&nbsp;新聞]]>")).toBe("財經 新聞");
    expect(safeUrl("https://example.com/news")).toBe("https://example.com/news");
    expect(safeUrl("javascript:alert(1)")).toBe("");
  });

  it("以真實首尾資料等距抽樣一年期淨值圖表", () => {
    const history = Array.from({ length: 10 }, (_, index) => ({ date: `2025-01-${String(index + 1).padStart(2, "0")}`, nav: index + 10 }));
    expect(sampleHistory(history, 4)).toEqual([
      { date: "2025-01-01", nav: 10 },
      { date: "2025-01-04", nav: 13 },
      { date: "2025-01-07", nav: 16 },
      { date: "2025-01-10", nav: 19 },
    ]);
  });
});
