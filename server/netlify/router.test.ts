import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const mocks = vi.hoisted(() => ({ getPublicDashboardData: vi.fn() }));

vi.mock("@netlify/identity", () => ({
  logout: vi.fn(),
  verifyRequestOrigin: vi.fn(),
}));

vi.mock("../services/dashboardRefresh", () => ({
  getPublicDashboardData: mocks.getPublicDashboardData,
  getPublicFundDetail: vi.fn(),
  getRSSHealthHistory: vi.fn(),
}));

vi.mock("../services/observatory", () => ({
  dailySummarySystemPrompt: vi.fn(),
  observatorySystemPrompt: vi.fn(),
  getDailySummaryByDate: vi.fn(),
  listDailySummaries: vi.fn(),
  saveDailySummary: vi.fn(),
}));

vi.mock("./llm", () => ({ invokeNetlifyLLM: vi.fn() }));

import { netlifyAppRouter } from "./router";

function context(role: "admin" | "user" | null): TrpcContext {
  return {
    req: { headers: { get: () => "127.0.0.1" } } as never,
    res: { clearCookie: () => undefined } as never,
    user: role ? {
      id: 1,
      openId: "netlify-user",
      name: "Netlify user",
      email: "owner@example.com",
      loginMethod: "netlify-identity",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } : null,
  };
}

describe("Netlify router", () => {
  beforeEach(() => vi.clearAllMocks());

  it("提供公開 dashboard 資料而不要求登入", async () => {
    mocks.getPublicDashboardData.mockResolvedValue({ refreshedAt: "2026-08-22T00:00:00.000Z" });

    const result = await netlifyAppRouter.createCaller(context(null)).dashboard.get();

    expect(result).toEqual({ refreshedAt: "2026-08-22T00:00:00.000Z" });
    expect(mocks.getPublicDashboardData).toHaveBeenCalledTimes(1);
  });

  it("只允許 Netlify Identity admin 產生每日摘要", async () => {
    await expect(netlifyAppRouter.createCaller(context("user")).observatory.generateDailySummary()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
