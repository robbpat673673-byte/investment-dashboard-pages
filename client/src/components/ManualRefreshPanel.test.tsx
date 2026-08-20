// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const refreshState = vi.hoisted(() => ({ isPending: false, mutate: vi.fn(), options: null as null | { onSuccess?: (value: unknown) => void; onError?: (error: Error) => void } }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    auth: { me: { useQuery: () => ({ data: { role: "admin" }, isLoading: false }) } },
    dashboard: { manualRefresh: { useMutation: (options: typeof refreshState.options) => { refreshState.options = options; return { isPending: refreshState.isPending, mutate: refreshState.mutate }; } } },
  },
}));

import { ManualRefreshPanel } from "./ManualRefreshPanel";

afterEach(() => {
  refreshState.isPending = false;
  refreshState.mutate.mockReset();
  refreshState.options = null;
});

describe("ManualRefreshPanel", () => {
  it("管理者可啟動刷新並查看四階段結果", async () => {
    render(<ManualRefreshPanel onCompleted={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "手動刷新" }));
    expect(refreshState.mutate).toHaveBeenCalledOnce();
    expect(screen.getByText("基金")).toBeTruthy();
    expect(screen.getByText("RSS 新聞")).toBeTruthy();
    expect(screen.getByText("行情")).toBeTruthy();
    expect(screen.getByText("總經歷史")).toBeTruthy();
    refreshState.options?.onSuccess?.({ status: "success", fundsUpdated: 31, newsUpdated: 21, marketUpdated: 20, macroPointsUpdated: 500, errors: [], stages: { funds: { status: "success", updated: 31 }, rss: { status: "success", updated: 21 }, market: { status: "success", updated: 20 }, macro: { status: "success", updated: 500 } } });
    await waitFor(() => expect(screen.getByText(/基金 31 檔、RSS 21 則、行情 20 項/)).toBeTruthy());
    expect(screen.getByText(/沒有錯誤/)).toBeTruthy();
  });

});
