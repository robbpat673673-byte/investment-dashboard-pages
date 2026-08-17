import React, { useMemo, useState } from "react";
import type { NewsPreferenceState } from "@/lib/newsPreferences";

type NewsItem = { id: number; title: string; summary: string | null; source: string; url: string; publishedAt: Date | string | null };
type Mode = "favorites" | "readLater";

function preferenceId(item: NewsItem) { return item.url || `${item.id}:${item.title}`; }
function displayDate(value: Date | string | null) { return value ? new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) : "未提供時間"; }

export function NewsLibraryPanel({ news, preferences, onChange, onBack }: { news: NewsItem[]; preferences: NewsPreferenceState; onChange: (next: NewsPreferenceState) => void; onBack: () => void }) {
  const [mode, setMode] = useState<Mode>("favorites");
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  const ids = new Set(preferences[mode]);
  const items = useMemo(() => news.filter(item => ids.has(preferenceId(item))).sort((a, b) => {
    const delta = new Date(a.publishedAt ?? 0).getTime() - new Date(b.publishedAt ?? 0).getTime();
    return sortDirection === "desc" ? -delta : delta;
  }), [news, preferences, mode, sortDirection]);
  const clearCurrent = () => onChange({ ...preferences, [mode]: [] });
  const remove = (item: NewsItem) => onChange({ ...preferences, [mode]: preferences[mode].filter(id => id !== preferenceId(item)) });

  return <section className="panel active news-library-panel">
    <div className="sec-title"><span>新聞管理</span><small>收藏與稍後閱讀</small></div>
    <div className="news-library-head"><button type="button" className="secondary-btn" onClick={onBack}>← 返回財經新聞</button><div className="news-library-controls" role="group" aria-label="新聞管理分頁"><button type="button" className={`filter-chip ${mode === "favorites" ? "active" : ""}`} onClick={() => setMode("favorites")}>收藏（{preferences.favorites.length}）</button><button type="button" className={`filter-chip ${mode === "readLater" ? "active" : ""}`} onClick={() => setMode("readLater")}>稍後閱讀（{preferences.readLater.length}）</button><button type="button" className="filter-chip" onClick={() => setSortDirection(current => current === "desc" ? "asc" : "desc")}>日期：{sortDirection === "desc" ? "新到舊" : "舊到新"}</button><button type="button" className="danger-btn" onClick={clearCurrent} disabled={items.length === 0}>清除目前清單</button></div></div>
    {items.length === 0 ? <div className="empty-inline">目前沒有{mode === "favorites" ? "收藏" : "稍後閱讀"}新聞。回到財經即時新聞即可加入。</div> : <div className="news-library-list">{items.map(item => <article className="news-library-item" key={preferenceId(item)}><div><a className="news-title" href={item.url} target="_blank" rel="noreferrer">{item.title}</a><p className="news-body">{item.summary || "沒有公開摘要。"}</p><div className="news-meta"><span>{item.source}</span><span>{displayDate(item.publishedAt)}</span></div></div><button type="button" className="news-action-button" onClick={() => remove(item)}>移除</button></article>)}</div>}
  </section>;
}
