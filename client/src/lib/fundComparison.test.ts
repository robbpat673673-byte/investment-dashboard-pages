import { describe, expect, it } from "vitest";
import { buildFundComparisonSeries } from "./fundComparison";

describe("buildFundComparisonSeries", () => {
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

  it("在任一基金歷史不足時不建立比較序列", () => {
    expect(buildFundComparisonSeries([{ date: "2025-01-01", nav: 10 }], [{ date: "2025-01-01", nav: 10 }, { date: "2025-02-01", nav: 11 }])).toBeNull();
  });
});
