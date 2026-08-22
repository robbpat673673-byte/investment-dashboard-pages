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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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
});
