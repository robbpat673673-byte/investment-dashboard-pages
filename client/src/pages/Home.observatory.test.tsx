// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

Object.defineProperty(globalThis, "ResizeObserver", {
  writable: true,
  value: class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
});

const mutationState = vi.hoisted(() => ({
  mode: "success" as "success" | "error" | "throttle",
  calls: [] as unknown[],
}));

const summaryState = vi.hoisted(() => ({
  mode: "success" as "success" | "error",
  generated: null as null | { id: number; summaryDate: string; generatedAt: string; snapshotAsOf: string; content: string; sources: unknown[] },
  refetch: vi.fn(),
}));

vi.mock("@/components/AIChatBox", () => ({
  AIChatBox: ({ messages, onSendMessage, suggestedPrompts }: { messages: Array<{ role: string; content: string }>; onSendMessage: (content: string) => void; suggestedPrompts?: string[] }) => <section aria-label="財經小智對話框">{messages.map((message, index) => <p key={index}>{message.content}</p>)}{suggestedPrompts?.map(prompt => <button key={prompt} type="button" onClick={() => onSendMessage(prompt)}>{prompt}</button>)}</section>,
}));

vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => <button type="button">深色</button> }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    dashboard: {
      get: {
        useQuery: () => ({
          isLoading: false,
          isFetching: false,
          refetch: vi.fn(),
          data: {
            domesticFunds: [],
            foreignFunds: [],
            market: [],
            news: [],
            lastRefresh: null,
            observatory: {
              asOf: "2026-08-16T04:00:00.000Z",
              pulse: "中性",
              breadth: { upCount: 2, downCount: 2, flatCount: 1, total: 5 },
              highlights: [{ ticker: "^TWII", name: "加權指數", price: 23100.1, percentChange: 0.42, quoteDate: "2026-08-16" }, { ticker: "^TNX", name: "美國 10 年期公債殖利率", price: 4.7, percentChange: 1.19, quoteDate: "2026-08-16" }],
              headlines: [{ title: "觀測站測試新聞", source: "Google 新聞・台灣財經", url: "https://example.com/news", publishedAt: "2026-08-16T03:30:00.000Z" }],
              sources: [{ label: "市場行情", detail: "Yahoo Finance 公開行情資料。", url: "https://finance.yahoo.com/" }],
              macroHistory: [{ ticker: "TWD=X", date: "2026-08-15", close: 32.1 }, { ticker: "^IRX", date: "2026-08-15", close: 5.2 }, { ticker: "^TNX", date: "2026-08-15", close: 4.3 }, { ticker: "^TYX", date: "2026-08-15", close: 4.9 }],
              dailySummary: null,
            },
          },
        }),
      },
    },
    observatory: {
      chat: {
        useMutation: (options: { onSuccess?: (value: { answer: string }) => void; onError?: (error: Error) => void }) => ({
          isPending: false,
          mutate: (payload: unknown) => {
            mutationState.calls.push(payload);
            if (mutationState.mode === "success") options.onSuccess?.({ answer: JSON.stringify(payload).includes("分析今日摘要") ? "## 事實\n摘要日期：2026-08-16；來源：每日財經摘要\n## 限制與風險\n測試限制。" : "## 事實\n測試成功回覆。來源：Yahoo Finance" });
            else if (mutationState.mode === "throttle") options.onError?.(new Error("觀測站問答已達暫時使用上限，請稍後再試。"));
            else options.onError?.(new Error("測試失敗"));
          },
        }),
      },
      summaryHistory: { useQuery: () => ({ data: summaryState.generated ? [summaryState.generated] : [], isLoading: false, refetch: summaryState.refetch }) },
      summaryByDate: { useQuery: () => ({ data: summaryState.generated }) },
      generateDailySummary: { useMutation: (options: { onSuccess?: (value: NonNullable<typeof summaryState.generated>) => void; onError?: (error: Error) => void }) => ({ isPending: false, mutate: vi.fn(() => {
        if (summaryState.mode === "success") {
          summaryState.generated = { id: 1, summaryDate: "2026-08-16", generatedAt: "2026-08-16T12:00:00.000Z", snapshotAsOf: "2026-08-16T11:50:00.000Z", content: "## 今日事實\n測試每日摘要。", sources: [] };
          options.onSuccess?.(summaryState.generated);
        } else options.onError?.(new Error("每日財經摘要生成失敗，請稍後再試。"));
      }) }) },
    },
  },
}));

import Home from "./Home";

afterEach(() => {
  cleanup();
  mutationState.mode = "success";
  mutationState.calls = [];
  summaryState.mode = "success";
  summaryState.generated = null;
  summaryState.refetch.mockReset();
  window.localStorage.clear();
  window.history.replaceState({}, "", "/");
});

describe("Home 觀測站", () => {
  it("可由財經即時新聞旁的頁籤切換，並渲染摘要、新聞來源與風險揭露", () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "觀測站" }));

    expect(screen.getByRole("heading", { name: "觀測站" })).toBeTruthy();
    expect(screen.getByText("重點行情與總經指標")).toBeTruthy();
    expect(screen.getByText("美國公債殖利率曲線")).toBeTruthy();
    expect(screen.getByText("美元／台幣歷史走勢")).toBeTruthy();
    expect(screen.getByText("異常通知設定")).toBeTruthy();
    expect(screen.getByText(/目前沒有標的超過已設定/)).toBeTruthy();
    expect(screen.getByText("觀測站測試新聞")).toBeTruthy();
    expect(screen.getByText("資料來源與使用限制")).toBeTruthy();
    expect(screen.getByText(/本頁內容為資料整理與一般性研究觀察/)).toBeTruthy();
  });

  it("分析今日摘要快速提問會被送入財經小智", async () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "觀測站" }));
    fireEvent.click(screen.getByRole("button", { name: "分析今日摘要" }));
    await waitFor(() => expect(screen.getByText(/摘要日期：2026-08-16/)).toBeTruthy());
    expect(screen.getByText(/測試限制/)).toBeTruthy();
    expect(JSON.stringify(mutationState.calls[0])).toContain("分析今日摘要");
  });

  it("啟用低門檻時顯示視覺化異常警示標籤", () => {
    window.localStorage.setItem("observatory-alert-preferences", JSON.stringify({ enabled: true, marketThreshold: 2, macroThreshold: 1 }));
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "觀測站" }));
    expect(screen.getByText(/門檻已觸發/)).toBeTruthy();
  });

  it("顯示警示日期與來源並支援已讀、忽略與復原", () => {
    window.localStorage.setItem("observatory-alert-preferences", JSON.stringify({ enabled: true, marketThreshold: 2, macroThreshold: 1 }));
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "觀測站" }));
    expect(screen.getByText(/觸發日期：2026-08-16/)).toBeTruthy();
    expect(screen.getByText(/資料來源：市場行情/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "標記為已讀" }));
    expect(screen.getByText("已讀")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "忽略" }));
    expect(screen.getByText(/已忽略 1 則警示/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "復原" }));
    expect(screen.getByRole("button", { name: "忽略" })).toBeTruthy();
  });

  it("重載觀測站時還原瀏覽器保存的圖表區間", () => {
    window.localStorage.setItem("investment-dashboard-observatory-chart-range", "1Y");
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "觀測站" }));
    expect(screen.getByText(/最近 1 年交易日/)).toBeTruthy();
  });

  it("支援 1 個月、3 個月、6 個月與 1 年圖表區間", () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "觀測站" }));
    expect(screen.getByRole("group", { name: "總經圖表時間區間" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "1個月" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "3個月" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "6個月" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "1年" }));
    expect(screen.getByText(/最近 1 年交易日/)).toBeTruthy();
  });

  it("在 375px viewport 下保留圖表區間與警示操作可用", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
    window.localStorage.setItem("observatory-alert-preferences", JSON.stringify({ enabled: true, marketThreshold: 2, macroThreshold: 1 }));
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "觀測站" }));
    expect(screen.getByRole("button", { name: "1個月" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "1年" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "標記為已讀" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "忽略" })).toBeTruthy();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
  });

  it("可從觀測站入口開啟警示歷史並篩選後返回", () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "觀測站" }));
    fireEvent.click(screen.getByRole("button", { name: "查看警示歷史" }));
    expect(screen.getByRole("heading", { name: "警示歷史紀錄" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "返回觀測站" }));
    expect(screen.getByRole("heading", { name: "觀測站" })).toBeTruthy();
  });

  it("可從主導覽開啟警示歷史並篩選後返回觀測站", () => {
    window.localStorage.setItem("investment-dashboard-observatory-alert-history", JSON.stringify([{ key: "^TNX:2026-08-16:1.19", ticker: "^TNX", name: "美國 10 年期公債殖利率", percentChange: 1.19, quoteDate: "2026-08-16", source: "市場行情", triggeredAt: "2026-08-16T05:00:00.000Z" }]));
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "警示歷史" }));
    expect(screen.getByRole("heading", { name: "警示歷史紀錄" })).toBeTruthy();
    expect(screen.getByText("美國 10 年期公債殖利率")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "已讀" }));
    expect(screen.getByText(/目前沒有符合條件/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "返回觀測站" }));
    expect(screen.getByRole("heading", { name: "觀測站" })).toBeTruthy();
  });

  it("在 375px 下可查看有紀錄的警示歷史並操作狀態篩選", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
    window.localStorage.setItem("investment-dashboard-observatory-alert-history", JSON.stringify([{ key: "^TNX:2026-08-16:1.19", ticker: "^TNX", name: "美國 10 年期公債殖利率", percentChange: 1.19, quoteDate: "2026-08-16", source: "市場行情", triggeredAt: "2026-08-16T05:00:00.000Z" }]));
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "警示歷史" }));
    expect(screen.getByText("美國 10 年期公債殖利率")).toBeTruthy();
    expect(screen.getByText(/觸發日期：2026-08-16/)).toBeTruthy();
    expect(screen.getByText(/資料來源：市場行情/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "未讀" }));
    expect(screen.getByText("美國 10 年期公債殖利率")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "標記為已讀" }));
    fireEvent.click(screen.getByRole("button", { name: "已讀" }));
    expect(screen.getAllByText("已讀").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "返回觀測站" }));
    expect(screen.getByRole("heading", { name: "觀測站" })).toBeTruthy();
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
  });

  it("送出問題後建立可回顧的對話歷史項目", async () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "觀測站" }));
    fireEvent.click(screen.getByRole("button", { name: "分析今日摘要" }));
    await waitFor(() => expect(window.localStorage.getItem("investment-dashboard-observatory-chat-history")).toContain("分析今日摘要"));
    expect(screen.getByText("對話歷史")).toBeTruthy();
  });

  it("財經小智問答成功時顯示回覆並傳送裁切後的訊息", async () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "觀測站" }));
    fireEvent.click(screen.getByRole("button", { name: "依本頁資料整理今日市場趨勢" }));

    await waitFor(() => expect(screen.getByText(/測試成功回覆。來源：Yahoo Finance/)).toBeTruthy());
    expect(mutationState.calls).toHaveLength(1);
    expect(JSON.stringify(mutationState.calls[0])).toContain("依本頁資料整理今日市場趨勢");
  });

  it("一鍵生成成功後刷新歷史紀錄並顯示最新摘要", async () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "觀測站" }));
    fireEvent.click(screen.getByRole("button", { name: "一鍵生成今日摘要" }));
    await waitFor(() => expect(screen.getByText("測試每日摘要。")).toBeTruthy());
    expect(summaryState.refetch).toHaveBeenCalled();
    const historyButton = screen.getAllByRole("button", { name: /2026/ }).find(button => button.textContent?.includes("20:00"));
    if (!historyButton) throw new Error("找不到摘要歷史按鈕");
    fireEvent.click(historyButton);
    expect(screen.getByText("測試每日摘要。")).toBeTruthy();
    expect(screen.getAllByText(/每日財經摘要/).length).toBeGreaterThan(0);
  });

  it("每日摘要生成失敗時顯示可理解的錯誤", async () => {
    summaryState.mode = "error";
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "觀測站" }));
    fireEvent.click(screen.getByRole("button", { name: "一鍵生成今日摘要" }));
    await waitFor(() => expect(screen.getByText("每日財經摘要生成失敗，請稍後再試。")).toBeTruthy());
  });

  it("財經小智問答失敗時顯示可理解的替代提示", async () => {
    mutationState.mode = "error";
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "觀測站" }));
    fireEvent.click(screen.getByRole("button", { name: "哪些新聞線索值得持續追蹤？" }));

    await waitFor(() => expect(screen.getByText(/目前無法產生觀測回覆/)).toBeTruthy());
  });

  it("財經小智問答節流時顯示稍後再試提示", async () => {
    mutationState.mode = "throttle";
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "觀測站" }));
    fireEvent.click(screen.getByRole("button", { name: "依本頁資料整理今日市場趨勢" }));
    await waitFor(() => expect(screen.getByText("提問過於頻繁，請稍後再試。")).toBeTruthy());
  });
});
