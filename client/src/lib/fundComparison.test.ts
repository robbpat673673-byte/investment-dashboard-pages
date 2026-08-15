import { describe, expect, it } from "vitest";
import { buildFundComparisonSeries, buildMultiComparisonSeries, sliceHistoryByMonths } from "./fundComparison";

describe("基金比較序列", () => {
  it("以兩檔基金共同可用期間為基準並各自正規化為 100", () => {
    const primary = [{ date: "2025-01-01", nav: 10 }, { date: "2025-02-01", nav: 11 }, { date: "2025-03-01", nav: 12 }];
    const secondary = [{ date: "2025-02-01", nav: 20 }, { date: "2025-03-01", nav: 18 }];
    const result = buildFundComparisonSeries(primary, secondary);
    expect(result?.startDate).toBe("2025-02-01");
    expect(result?.primary[0]).toMatchObject({ value: 100 });
    expect(result?.secondary[0]).toMatchObject({ value: 100 });
    expect(result?.primary.at(-1)?.value).toBeCloseTo(109.09, 2);
    expect(result?.secondary.at(-1)?.value).toBe(90);
  });

  it("依近月數裁切歷史並保留時間窗內資料", () => {
    const history = [{ date: "2026-01-01", nav: 10 }, { date: "2026-06-01", nav: 12 }, { date: "2026-07-01", nav: 13 }];
    expect(sliceHistoryByMonths(history, 1).map(point => point.date)).toEqual(["2026-06-01", "2026-07-01"]);
  });

  it("可將兩檔基金與基準指數於共同期間正規化比較", () => {
    const result = buildMultiComparisonSeries([
      { key: "fund", label: "基金", history: [{ date: "2026-01-01", nav: 10 }, { date: "2026-02-01", nav: 11 }] },
      { key: "other", label: "比較基金", history: [{ date: "2026-01-01", nav: 20 }, { date: "2026-02-01", nav: 18 }] },
      { key: "benchmark", label: "S&P 500", history: [{ date: "2026-01-01", nav: 100 }, { date: "2026-02-01", nav: 105 }] },
    ]);
    expect(result?.lines).toHaveLength(3);
    expect(result?.lines.every(line => line.points[0]?.value === 100)).toBe(true);
    expect(result?.lines[2]?.points.at(-1)?.value).toBe(105);
  });

  it("在任一基金歷史不足時不建立雙基金比較序列", () => {
    expect(buildFundComparisonSeries([{ date: "2025-01-01", nav: 10 }], [{ date: "2025-01-01", nav: 10 }, { date: "2025-02-01", nav: 11 }])).toBeNull();
  });
});
