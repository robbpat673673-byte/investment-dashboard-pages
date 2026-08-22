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
});
