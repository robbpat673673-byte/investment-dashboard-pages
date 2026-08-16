import { describe, expect, it } from "vitest";
import { filterMacroHistoryByDays, parseChartRange, serializeChartRange } from "./observatoryChart";

describe("macro chart calendar range", () => {
  it("parses and serializes the browser range preference safely", () => {
    expect(parseChartRange("1Y")).toBe("1Y");
    expect(parseChartRange("bad")).toBe("3M");
    expect(parseChartRange(null)).toBe("3M");
    expect(serializeChartRange("6M")).toBe("6M");
  });
  const points = [
    { date: "2026-01-01", close: 1 },
    { date: "2026-01-15", close: 2 },
    { date: "2026-02-01", close: 3 },
    { date: "2026-02-28", close: 4 },
    { date: "2026-03-01", close: 5 },
  ];

  it("filters by calendar days from the latest point, not row count", () => {
    expect(filterMacroHistoryByDays(points, 31).map(point => point.date)).toEqual(["2026-02-01", "2026-02-28", "2026-03-01"]);
    expect(filterMacroHistoryByDays(points, 60).map(point => point.date)).toEqual(["2026-01-01", "2026-01-15", "2026-02-01", "2026-02-28", "2026-03-01"]);
  });

  it("sorts unsorted valid dates and returns an empty series safely", () => {
    expect(filterMacroHistoryByDays([points[4], points[0]], 366).map(point => point.date)).toEqual(["2026-01-01", "2026-03-01"]);
    expect(filterMacroHistoryByDays([], 31)).toEqual([]);
    expect(filterMacroHistoryByDays([{ date: "not-a-date", close: 1 }], 31)).toEqual([]);
  });
});
