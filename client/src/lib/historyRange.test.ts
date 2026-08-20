import { describe, expect, it } from "vitest";
import { parseHistoryRange, sliceHistoryByRange } from "./historyRange";

describe("historyRange", () => {
  const history = [
    { date: "2026-08-20", value: 120 },
    { date: "2026-07-20", value: 110 },
    { date: "2026-05-20", value: 100 },
    { date: "2026-02-20", value: 90 },
    { date: "2025-08-20", value: 80 },
  ];

  it("依最新資料日期裁切四個日曆區間", () => {
    expect(sliceHistoryByRange(history, "1M").map(point => point.date)).toEqual(["2026-07-20", "2026-08-20"]);
    expect(sliceHistoryByRange(history, "3M").map(point => point.date)).toEqual(["2026-05-20", "2026-07-20", "2026-08-20"]);
    expect(sliceHistoryByRange(history, "6M").map(point => point.date)).toEqual(["2026-02-20", "2026-05-20", "2026-07-20", "2026-08-20"]);
    expect(sliceHistoryByRange(history, "1Y")).toHaveLength(5);
  });

  it("先排序資料且無效偏好回到一年", () => {
    expect(sliceHistoryByRange([history[0], history[4], history[2]], "1Y").map(point => point.date)).toEqual(["2025-08-20", "2026-05-20", "2026-08-20"]);
    expect(parseHistoryRange("3M")).toBe("3M");
    expect(parseHistoryRange("invalid")).toBe("1Y");
    expect(parseHistoryRange(null)).toBe("1Y");
  });
});
