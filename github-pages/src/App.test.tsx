// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import App from "./App";

const dashboardPayload = {
  generatedAt: "2026-08-22T00:00:00.000Z",
  markets: [],
  funds: [],
  news: [],
  sourceHealth: [],
  errors: [],
};

const degradedDashboardPayload = {
  ...dashboardPayload,
  sourceHealth: [{ source: "CNBC・財經市場", status: "error", acceptedCount: 0, latencyMs: 842, detail: "來源回應逾時" }],
  errors: ["道瓊指數：行情來源暫時無法回應"],
};

const interactiveDashboardPayload = {
  ...dashboardPayload,
  markets: [{ ticker: "^GSPC", name: "標普 500", price: 6450.1, change: 12.3, percentChange: 0.19, quoteDate: "2026-08-21", history: [{ date: "2026-08-20", value: 6437.8 }, { date: "2026-08-21", value: 6450.1 }] }],
  funds: [{ id: "fund-1", type: "domestic" as const, name: "示範基金", code: "DEMO", currency: "TWD", asOfDate: "2026-08-21", nav: 10.25, returns: { week: 1, month: 2, quarter: 3, halfYear: 4, year: 5 }, history: [{ date: "2026-08-20", value: 10.1 }, { date: "2026-08-21", value: 10.25 }] }],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("靜態公開儀表板載入體驗", () => {
  it("在 JSON 回應前顯示骨架屏，完成後顯示資料內容", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { resolveFetch = resolve; })));

    render(<App />);
    expect(screen.getByLabelText("正在載入公開投資資料")).not.toBeNull();

    await waitFor(() => expect(resolveFetch).toBeDefined());
    resolveFetch?.({ ok: true, json: async () => dashboardPayload } as Response);

    await waitFor(() => expect(screen.queryByLabelText("正在載入公開投資資料")).toBeNull());
    expect(screen.getByRole("heading", { name: "全球市場" })).not.toBeNull();
  });

  it("切換深色模式後會保存偏好並更新根元素", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => dashboardPayload } as Response)));
    render(<App />);

    const toggle = await screen.findByRole("button", { name: "切換為深色模式" });
    fireEvent.click(toggle);

    expect(localStorage.getItem("static-dashboard:theme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("button", { name: "切換為淺色模式" })).not.toBeNull();
  });

  it("在資料來源異常時顯示可展開的真實診斷原因", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => degradedDashboardPayload } as Response)));
    render(<App />);

    const details = await screen.findByText("資料來源診斷");
    expect(details).not.toBeNull();
    fireEvent.click(details);

    expect(screen.getByText("來源回應逾時")).not.toBeNull();
    expect(screen.getAllByText("道瓊指數：行情來源暫時無法回應").length).toBeGreaterThan(0);
    expect(screen.getByText("延遲 842 ms")).not.toBeNull();
  });

  it("可重新讀取已發布快照，並顯示管理者立即更新指引", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => interactiveDashboardPayload } as Response));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    expect(await screen.findByRole("button", { name: "重新讀取最新資料" })).not.toBeNull();
    expect(screen.getByText("管理者立即更新資料")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "重新讀取最新資料" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/已重新讀取最新已發布資料/)).not.toBeNull();
  });

  it("可用鍵盤查看圖表精確日期與數值，並下載目前篩選的 CSV", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => interactiveDashboardPayload } as Response)));
    const createObjectURL = vi.fn(() => "blob:dashboard");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    render(<App />);

    const chart = await screen.findByRole("img", { name: /標普 500 價格走勢圖/ });
    fireEvent.focus(chart);
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(await screen.findByText("2026-08-20")).not.toBeNull();
    expect(screen.getByText("價格 6,437.8")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "匯出市場 CSV" }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:dashboard");
  });
});
