import { describe, expect, it } from "vitest";
import { buildNewsHealthTrend } from "./newsHealthTrend";

describe("news health trend transformation", () => {
  it("以 refreshRunId 對齊來源並計算累積成功率", () => {
    const result = buildNewsHealthTrend([
      { refreshRunId: 1, source: "A", status: "fresh", acceptedCount: 4, latencyMs: 100, recordedAt: "2026-08-15T00:00:00.000Z" },
      { refreshRunId: 1, source: "B", status: "error", acceptedCount: 0, latencyMs: 800, recordedAt: "2026-08-15T00:00:01.000Z" },
      { refreshRunId: 2, source: "A", status: "fresh", acceptedCount: 4, latencyMs: 120, recordedAt: "2026-08-16T00:00:00.000Z" },
      { refreshRunId: 2, source: "B", status: "fresh", acceptedCount: 4, latencyMs: 500, recordedAt: "2026-08-16T00:00:01.000Z" },
    ]);
    expect(result.batchCount).toBe(2);
    expect(result.successData).toHaveLength(2);
    expect(result.successData[0]).toMatchObject({ A: 100, B: 0 });
    expect(result.successData[1]).toMatchObject({ A: 100, B: 50 });
    expect(result.latencyData[0]).toMatchObject({ A: 100, B: 800 });
    expect(result.latencyData[1]).toMatchObject({ A: 120, B: 500 });
  });

  it("缺少來源資料時保留 null，不製造零延遲下探", () => {
    const result = buildNewsHealthTrend([
      { refreshRunId: 1, source: "A", status: "fresh", acceptedCount: 1, latencyMs: 100, recordedAt: "2026-08-15T00:00:00.000Z" },
      { refreshRunId: 2, source: "B", status: "fresh", acceptedCount: 1, latencyMs: 200, recordedAt: "2026-08-16T00:00:00.000Z" },
    ]);
    expect(result.latencyData[0]).toMatchObject({ A: 100, B: null });
    expect(result.latencyData[1]).toMatchObject({ A: null, B: 200 });
    expect(result.successData[0]).toMatchObject({ A: 100, B: null });
  });
});
