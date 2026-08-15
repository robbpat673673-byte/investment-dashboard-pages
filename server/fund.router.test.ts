import { beforeEach, describe, expect, it, vi } from "vitest";

const { detailMock } = vi.hoisted(() => ({ detailMock: vi.fn() }));

vi.mock("./services/dashboardRefresh", () => ({
  getPublicDashboardData: vi.fn(),
  getPublicFundDetail: detailMock,
}));

import { appRouter } from "./routers";

describe("fund.detail public query", () => {
  beforeEach(() => {
    detailMock.mockReset();
    detailMock.mockResolvedValue({ id: 30001, history: [{ date: "2026-08-13", nav: 16.66 }], perf: { week: 0.39, month: -1.19, quarter: -1.51, halfYear: 15.62, year: 33.4 }, source: { name: "MoneyDJ／合庫基金圖表資料" } });
  });

  it("公開回傳基金完整歷史、區間比較與來源資料", async () => {
    const caller = appRouter.createCaller({} as never);
    await expect(caller.fund.detail({ id: 30001 })).resolves.toMatchObject({ id: 30001, history: [{ nav: 16.66 }], perf: { year: 33.4 }, source: { name: "MoneyDJ／合庫基金圖表資料" } });
    expect(detailMock).toHaveBeenCalledWith(30001);
  });

  it("拒絕無效的基金識別碼", async () => {
    const caller = appRouter.createCaller({} as never);
    await expect(caller.fund.detail({ id: 0 })).rejects.toBeDefined();
  });
});
