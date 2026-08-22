import React, { useEffect, useMemo, useState } from "react";
import { filterHistoryRange, isStaticDashboard, sortStaticFunds, staticDashboardUrl, type HistoryRange, type StaticDashboard, type StaticPoint, type StaticSourceHealth } from "./staticDashboard";
import { applyStaticTheme, readStaticTheme, STATIC_THEME_KEY, type StaticTheme } from "./staticPreferences";

const periods = [["week", "近 1 週"], ["month", "近 1 月"], ["quarter", "近 3 月"], ["halfYear", "近半年"], ["year", "近 1 年"]] as const;
const safeStoredList = (key: string) => { try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; } catch { return []; } };

function Sparkline({ points, positive }: { points: StaticPoint[]; positive?: boolean }) {
  if (points.length < 2) return <span className="empty-chart">資料不足</span>;
  const values = points.map(point => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const magnitude = max - min || 1;
  const path = points.map((point, index) => `${(index / (points.length - 1)) * 100},${100 - ((point.value - min) / magnitude) * 100}`).join(" ");
  return <svg className={`sparkline ${positive ? "up" : "down"}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="近期走勢圖"><polyline points={path} fill="none" vectorEffect="non-scaling-stroke" /></svg>;
}

const formatPct = (value: number | null | undefined) => value === null || value === undefined ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
const formatDate = (value: string | null) => value ? new Date(value).toLocaleString("zh-TW", { dateStyle: "medium", timeStyle: "short", hour12: false }) : "尚未更新";

function DashboardSkeleton() {
  return <section className="skeleton-region" aria-busy="true" aria-live="polite" aria-label="正在載入公開投資資料">
    <div className="skeleton-intro"><span className="skeleton-line title" /><span className="skeleton-line text" /></div>
    <div className="skeleton-grid markets">{Array.from({ length: 8 }, (_, index) => <article className="skeleton-card" key={`market-${index}`}><span className="skeleton-line label" /><span className="skeleton-line value" /><span className="skeleton-chart" /></article>)}</div>
    <div className="skeleton-intro funds"><span className="skeleton-line title" /><span className="skeleton-line text" /></div>
    <div className="skeleton-grid fund-cards">{Array.from({ length: 6 }, (_, index) => <article className="skeleton-card" key={`fund-${index}`}><span className="skeleton-line label" /><span className="skeleton-line value" /><span className="skeleton-chart" /><span className="skeleton-line return-line" /></article>)}</div>
    <p className="loading-copy">正在取得公開市場、基金與 RSS 資料…</p>
  </section>;
}

export default function App() {
  const [dashboard, setDashboard] = useState<StaticDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fundType, setFundType] = useState<"domestic" | "foreign">("domestic");
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<HistoryRange>(() => (localStorage.getItem("static-dashboard:range") as HistoryRange) || "1y");
  const [theme, setTheme] = useState<StaticTheme>(() => readStaticTheme(localStorage));
  const [sort, setSort] = useState<"name" | "year" | "month">("year");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => safeStoredList("static-dashboard:favorites"));
  const [newsQuery, setNewsQuery] = useState("");
  const [newsSource, setNewsSource] = useState("all");
  const [savedNews, setSavedNews] = useState<string[]>(() => safeStoredList("static-dashboard:saved-news"));
  const [readLater, setReadLater] = useState<string[]>(() => safeStoredList("static-dashboard:read-later"));

  useEffect(() => {
    fetch(staticDashboardUrl(), { cache: "no-store" })
      .then(response => response.ok ? response.json() as Promise<unknown> : Promise.reject(new Error(`資料讀取失敗（${response.status}）`)))
      .then(payload => { if (!isStaticDashboard(payload)) throw new Error("靜態資料格式不完整"); setDashboard(payload); })
      .catch(fetchError => setError(fetchError instanceof Error ? fetchError.message : "無法讀取靜態資料"))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { applyStaticTheme(theme, document.documentElement); localStorage.setItem(STATIC_THEME_KEY, theme); }, [theme]);
  useEffect(() => { localStorage.setItem("static-dashboard:range", range); }, [range]);
  useEffect(() => { localStorage.setItem("static-dashboard:favorites", JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem("static-dashboard:saved-news", JSON.stringify(savedNews)); }, [savedNews]);
  useEffect(() => { localStorage.setItem("static-dashboard:read-later", JSON.stringify(readLater)); }, [readLater]);

  const filteredFunds = useMemo(() => sortStaticFunds((dashboard?.funds ?? []).filter(fund => fund.type === fundType && (!favoritesOnly || favorites.includes(fund.id)) && `${fund.name} ${fund.code ?? ""}`.toLowerCase().includes(query.toLowerCase())), sort), [dashboard, fundType, favoritesOnly, favorites, query, sort]);
  const filteredNews = useMemo(() => (dashboard?.news ?? []).filter(news => (newsSource === "all" || news.source === newsSource) && `${news.title} ${news.summary}`.toLowerCase().includes(newsQuery.toLowerCase())), [dashboard, newsQuery, newsSource]);
  const latestNewsAt = useMemo(() => (dashboard?.news ?? []).map(news => news.publishedAt).sort().at(-1) ?? null, [dashboard]);
  const sourceDiagnostics = useMemo(() => {
    const sourceRows = ((dashboard?.sourceHealth ?? []) as StaticSourceHealth[]).filter(source => source.status !== "fresh").map(source => ({
      key: `source-${source.source}`,
      label: source.source,
      status: source.status,
      detail: source.detail || (source.status === "empty" ? "最近 7 日沒有內容通過新鮮度條件。" : "此來源本次未完成更新。"),
      acceptedCount: source.acceptedCount,
      latencyMs: source.latencyMs,
    }));
    const taskRows = (dashboard?.errors ?? []).map((detail, index) => ({ key: `task-${index}`, label: "資料更新工作", status: "error", detail, acceptedCount: null, latencyMs: undefined }));
    return [...sourceRows, ...taskRows];
  }, [dashboard]);
  const toggleItem = (value: string, list: string[], setList: (next: string[]) => void) => setList(list.includes(value) ? list.filter(item => item !== value) : [...list, value]);

  return <main className="shell">
    <header className="hero">
      <div><p className="eyebrow">PUBLIC STATIC EDITION</p><h1>投資儀表板</h1><p>全球市場、基金淨值與財經 RSS，一天更新一次。</p></div>
      <div className="hero-tools"><button className="theme-toggle" aria-label={`切換為${theme === "dark" ? "淺色" : "深色"}模式`} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}><span className="theme-symbol" aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span><span>{theme === "dark" ? "淺色模式" : "深色模式"}</span></button><div className="update-chip"><strong>資料更新</strong><span>{formatDate(dashboard?.generatedAt ?? null)}</span></div></div>
    </header>
    <section className="static-note" aria-label="靜態版限制"><strong>靜態公開版</strong><span>資料由 GitHub Actions 每日台北時間 08:00 產生。此版本不提供登入、手動刷新、即時進度、資料庫寫入、AI 摘要；自選、新聞收藏與稍後閱讀僅保存在此瀏覽器。</span></section>
    {error ? <section className="error">{error}。請稍後重新整理，或在 GitHub Actions 手動執行「更新並發布靜態資料」。</section> : null}
    {isLoading ? <DashboardSkeleton /> : null}
    {dashboard ? <>
      {dashboard.errors.length ? <section className="warning"><strong>部分來源本次未更新：</strong>{dashboard.errors.slice(0, 4).join("；")}</section> : null}
      <section className="section"><div className="section-heading"><div><p className="eyebrow">MARKETS</p><h2>全球市場</h2></div><div className="range-controls">{(["1m", "3m", "6m", "1y"] as HistoryRange[]).map(item => <button key={item} className={range === item ? "active" : ""} onClick={() => setRange(item)}>{item.toUpperCase()}</button>)}</div></div><div className="market-grid">{dashboard.markets.slice(0, 8).map(market => <article className="market-card" key={market.ticker}><div className="card-head"><span>{market.name}</span><small>{market.quoteDate}</small></div><strong>{market.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}</strong><div className={`change ${market.percentChange >= 0 ? "positive" : "negative"}`}>{formatPct(market.percentChange)} <span>{market.change.toFixed(2)}</span></div><Sparkline points={filterHistoryRange(market.history, range)} positive={market.percentChange >= 0} /></article>)}</div></section>
      <section className="section"><div className="section-heading fund-heading"><div><p className="eyebrow">FUNDS</p><h2>基金淨值與區間報酬</h2></div><div className="fund-controls"><button className={fundType === "domestic" ? "active" : ""} onClick={() => setFundType("domestic")}>國內基金</button><button className={fundType === "foreign" ? "active" : ""} onClick={() => setFundType("foreign")}>國際基金</button><button className={favoritesOnly ? "active" : ""} onClick={() => setFavoritesOnly(!favoritesOnly)}>我的自選</button><select aria-label="基金排序" value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="year">近一年報酬</option><option value="month">近一月報酬</option><option value="name">基金名稱</option></select><input aria-label="搜尋基金" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜尋名稱或代碼" /></div></div><div className="fund-grid">{filteredFunds.map(fund => <article className="fund-card" key={fund.id}><div className="card-head"><div><strong>{fund.name}</strong><small>{fund.code ?? fund.id} · {fund.currency}</small></div><div className="fund-head-actions"><button className={favorites.includes(fund.id) ? "saved" : ""} aria-label={`切換 ${fund.name} 自選`} onClick={() => toggleItem(fund.id, favorites, setFavorites)}>{favorites.includes(fund.id) ? "★" : "☆"}</button><span>{fund.asOfDate}</span></div></div><div className="nav-value">{fund.nav.toLocaleString("en-US", { maximumFractionDigits: 4 })}<small>淨值</small></div><Sparkline points={filterHistoryRange(fund.history, range)} positive={(fund.returns.year ?? 0) >= 0} /><div className="returns">{periods.map(([key, label]) => <span key={key}><small>{label}</small><b className={(fund.returns[key] ?? 0) >= 0 ? "positive" : "negative"}>{formatPct(fund.returns[key])}</b></span>)}</div></article>)}</div>{filteredFunds.length === 0 ? <p className="empty">沒有符合條件的基金。</p> : null}</section>
      <section className="section news-section"><div className="section-heading fund-heading"><div><p className="eyebrow">RSS NEWS</p><h2>財經即時新聞</h2></div><div className="news-controls"><select aria-label="新聞來源篩選" value={newsSource} onChange={event => setNewsSource(event.target.value)}><option value="all">全部來源</option>{dashboard.sourceHealth.map(source => <option key={source.source} value={source.source}>{source.source}</option>)}</select><input aria-label="搜尋新聞" value={newsQuery} onChange={event => setNewsQuery(event.target.value)} placeholder="搜尋新聞標題或摘要" /></div></div><div className="news-trust-grid" aria-label="新聞來源與更新資訊"><article className="trust-card"><span className="trust-label">已納入來源</span><strong>{new Set(dashboard.news.map(news => news.source)).size} 個來源</strong><small>依來源新鮮度與配額整理</small></article><article className="trust-card"><span className="trust-label">最新新聞時間</span><strong>{formatDate(latestNewsAt)}</strong><small>依文章發布時間排序</small></article><article className="trust-card"><span className="trust-label">資料同步時間</span><strong>{formatDate(dashboard.generatedAt)}</strong><small>GitHub Actions 公開資料快照</small></article></div>{sourceDiagnostics.length ? <details className="source-diagnostics"><summary><span><strong>資料來源診斷</strong><small>{sourceDiagnostics.length} 項需注意</small></span><span className="diagnostic-toggle">展開明細</span></summary><div className="diagnostic-grid">{sourceDiagnostics.map(item => <article className={`diagnostic-card ${item.status}`} key={item.key}><div><span className="diagnostic-status">{item.status === "error" ? "載入失敗" : "沒有新資料"}</span><strong>{item.label}</strong></div><p>{item.detail}</p><footer><span>本次接受 {item.acceptedCount ?? 0} 則</span>{item.latencyMs !== undefined ? <span>延遲 {item.latencyMs} ms</span> : null}<span>檢查於 {formatDate(dashboard.generatedAt)}</span></footer></article>)}</div></details> : null}<div className="news-list">{filteredNews.slice(0, 20).map(news => <article key={`${news.source}-${news.url}`}><a href={news.url} target="_blank" rel="noreferrer"><div className="news-meta"><span className="source-badge">來源：{news.source}</span><time dateTime={news.publishedAt}>發布：{formatDate(news.publishedAt)}</time></div><strong>{news.title}</strong>{news.summary ? <p>{news.summary}</p> : null}</a><div className="news-actions"><button className={savedNews.includes(news.url) ? "saved" : ""} onClick={() => toggleItem(news.url, savedNews, setSavedNews)}>{savedNews.includes(news.url) ? "已收藏" : "收藏"}</button><button className={readLater.includes(news.url) ? "saved" : ""} onClick={() => toggleItem(news.url, readLater, setReadLater)}>{readLater.includes(news.url) ? "已加入稍後閱讀" : "稍後閱讀"}</button></div></article>)}</div>{filteredNews.length === 0 ? <p className="empty">沒有符合條件的新聞。</p> : null}<div className="health">{dashboard.sourceHealth.map(source => <span key={source.source} className={source.status}>{source.source}：{source.status}（{source.acceptedCount}）</span>)}</div></section>
    </> : null}
  </main>;
}
