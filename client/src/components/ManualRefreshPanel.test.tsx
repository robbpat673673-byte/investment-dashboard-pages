// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

class MockEventSource {
  static latest: MockEventSource | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  readyState = 1;
  constructor(public url: string) { MockEventSource.latest = this; }
  addEventListener() {}
  close() { this.readyState = 2; }
  emit(payload: unknown) { this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent); }
}

vi.stubGlobal("EventSource", MockEventSource);
vi.mock("@/lib/trpc", () => ({ trpc: { auth: { me: { useQuery: () => ({ data: { role: "admin" }, isLoading: false }) } } } }));

import { ManualRefreshPanel } from "./ManualRefreshPanel";

afterEach(() => { cleanup(); MockEventSource.latest = null; });

describe("ManualRefreshPanel SSE", () => {
  it("取消刷新會呼叫取消端點並關閉 SSE", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(<ManualRefreshPanel onCompleted={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "手動刷新" }));
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/refresh/cancel", expect.objectContaining({ method: "POST" })));
    expect(screen.getByText("刷新已取消")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "取消" })).toBeNull();
    vi.unstubAllGlobals();
    vi.stubGlobal("EventSource", MockEventSource);
  });

  it("接收伺服器階段事件並顯示完成摘要", async () => {
    render(<ManualRefreshPanel onCompleted={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "手動刷新" }));
    expect(MockEventSource.latest?.url).toMatch(/^\/api\/admin\/refresh\/stream\?requestId=/);
    MockEventSource.latest?.emit({ type: "stage-start", stage: "funds", completed: 0, total: 2 });
    MockEventSource.latest?.emit({ type: "stage-progress", stage: "funds", completed: 1, total: 2, updated: 1 });
    await waitFor(() => expect(screen.getByText(/1\/2/)).toBeTruthy());
    MockEventSource.latest?.emit({ type: "complete", result: { status: "success", fundsUpdated: 2, newsUpdated: 4, marketUpdated: 3, macroPointsUpdated: 10, errors: [], stages: {} } });
    await waitFor(() => expect(screen.getByText(/基金 2 檔、RSS 4 則、行情 3 項/)).toBeTruthy());
  });
});
