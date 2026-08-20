import { beforeEach, describe, expect, it, vi } from "vitest";

const { historyMock } = vi.hoisted(() => ({ historyMock: vi.fn() }));

vi.mock("./services/dashboardRefresh", () => ({
  getPublicDashboardData: vi.fn(),
  getPublicFundDetail: vi.fn(),
  getRSSHealthHistory: historyMock,
}));

import { appRouter } from "./routers";

describe("dashboard.newsSourceHealthHistory public query", () => {
  beforeEach(() => {
    historyMock.mockReset();
    historyMock.mockResolvedValue([{ refreshRunId: 7, source: "CNBC・財經市場", status: "fresh", acceptedCount: 4, latencyMs: 320, recordedAt: new Date("2026-08-16T04:00:00.000Z") }]);
  });

  it("回傳來源健康歷史並傳遞查詢筆數", async () => {
    const caller = appRouter.createCaller({} as never);
    await expect(caller.dashboard.newsSourceHealthHistory({ limit: 21 })).resolves.toMatchObject([{ refreshRunId: 7, source: "CNBC・財經市場", status: "fresh", latencyMs: 320 }]);
    expect(historyMock).toHaveBeenCalledWith(21);
  });

  it("未提供輸入時使用預設 14 批次", async () => {
    const caller = appRouter.createCaller({} as never);
    await caller.dashboard.newsSourceHealthHistory();
    expect(historyMock).toHaveBeenCalledWith(14);
  });
});
