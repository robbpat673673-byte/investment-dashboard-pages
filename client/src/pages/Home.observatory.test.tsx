// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";

const mutationState = vi.hoisted(() => ({
  mode: "success" as "success" | "error",
  calls: [] as unknown[],
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
              highlights: [{ ticker: "^TWII", name: "加權指數", price: 23100.1, percentChange: 0.42, quoteDate: "2026-08-16" }],
              headlines: [{ title: "觀測站測試新聞", source: "Google 新聞・台灣財經", url: "https://example.com/news", publishedAt: "2026-08-16T03:30:00.000Z" }],
              sources: [{ label: "市場行情", detail: "Yahoo Finance 公開行情資料。", url: "https://finance.yahoo.com/" }],
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
            if (mutationState.mode === "success") options.onSuccess?.({ answer: "## 事實\n測試成功回覆。來源：Yahoo Finance" });
            else options.onError?.(new Error("測試失敗"));
          },
        }),
      },
    },
  },
}));

import Home from "./Home";

afterEach(() => {
  cleanup();
  mutationState.mode = "success";
  mutationState.calls = [];
  window.history.replaceState({}, "", "/");
});

describe("Home 觀測站", () => {
  it("可由財經即時新聞旁的頁籤切換，並渲染摘要、新聞來源與風險揭露", () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "觀測站" }));

    expect(screen.getByRole("heading", { name: "觀測站" })).toBeTruthy();
    expect(screen.getByText("市場資料快照")).toBeTruthy();
    expect(screen.getByText("觀測站測試新聞")).toBeTruthy();
    expect(screen.getByText("資料來源與使用限制")).toBeTruthy();
    expect(screen.getByText(/本頁內容為資料整理與一般性研究觀察/)).toBeTruthy();
  });

  it("財經小智問答成功時顯示回覆並傳送裁切後的訊息", async () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "觀測站" }));
    fireEvent.click(screen.getByRole("button", { name: "依本頁資料整理今日市場趨勢" }));

    await waitFor(() => expect(screen.getByText(/測試成功回覆。來源：Yahoo Finance/)).toBeTruthy());
    expect(mutationState.calls).toHaveLength(1);
    expect(JSON.stringify(mutationState.calls[0])).toContain("依本頁資料整理今日市場趨勢");
  });

  it("財經小智問答失敗時顯示可理解的替代提示", async () => {
    mutationState.mode = "error";
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "觀測站" }));
    fireEvent.click(screen.getByRole("button", { name: "哪些新聞線索值得持續追蹤？" }));

    await waitFor(() => expect(screen.getByText(/目前無法產生觀測回覆/)).toBeTruthy());
  });
});
