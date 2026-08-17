// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NewsLibraryPanel } from "./NewsLibraryPanel";

const news = [
  { id: 1, title: "較早新聞", summary: "早摘要", source: "來源 A", url: "https://example.com/a", publishedAt: "2026-08-15T01:00:00.000Z" },
  { id: 2, title: "較新新聞", summary: "新摘要", source: "來源 B", url: "https://example.com/b", publishedAt: "2026-08-16T01:00:00.000Z" },
];

afterEach(() => cleanup());

describe("NewsLibraryPanel", () => {
  it("依日期顯示收藏並可切換舊到新排序", () => {
    const onChange = vi.fn();
    render(<NewsLibraryPanel news={news} preferences={{ favorites: [news[0].url, news[1].url], readLater: [] }} onChange={onChange} onBack={vi.fn()} />);
    expect(screen.getByText("較新新聞")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /日期：新到舊/ }));
    const titles = screen.getAllByRole("link").map(link => link.textContent);
    expect(titles).toEqual(["較早新聞", "較新新聞"]);
  });

  it("可清除目前分頁並移除單則項目", () => {
    const onChange = vi.fn();
    render(<NewsLibraryPanel news={news} preferences={{ favorites: [news[0].url], readLater: [news[1].url] }} onChange={onChange} onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "清除目前清單" }));
    expect(onChange).toHaveBeenCalledWith({ favorites: [], readLater: [news[1].url] });
    fireEvent.click(screen.getByRole("button", { name: "移除" }));
    expect(onChange).toHaveBeenCalledWith({ favorites: [], readLater: [news[1].url] });
  });
});
