import React, { useEffect, useMemo, useState } from "react";
import {
  createFundsCsv,
  createMarketsCsv,
  filterHistoryRange,
  isStaticDashboard,
  sortStaticFunds,
  staticDashboardUrl,
  type HistoryRange,
  type StaticDashboard,
  type StaticPoint,
  type StaticSourceHealth,
} from "./staticDashboard";
import { applyStaticTheme, readStaticTheme, STATIC_THEME_KEY, type StaticTheme } from "./staticPreferences";

const periods = [["week", "近 1 週"], ["month", "近 1 月"], ["quarter", "近 3 月"], ["halfYear", "近半年"], ["year", "近 1 年"]] as const;
const safeStoredList = (key: string) => { try { const value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; } catch { return []; } };
const formatPct = (value: number | null | undefined) => value === null || value === undefined ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
const formatDate = (value: string | null) => value ? new Date(value).toLocaleString("zh-TW", { dateStyle: "medium", timeStyle: "short", hour12: false }) : "尚未更新";
const formatChartValue = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 4 });

function Sparkline({ points, positive, label, valueLabel }: { points: StaticPoint[]; positive?: boolean; label: string; valueLabel: string }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  if (points.length < 2) return <span className="empty-chart">資料不足</span>;

  const values = points.map(point => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const magnitude = max - min || 1;
  const coordinate = (point: StaticPoint, index: number) => ({
    x: (index / (points.length - 1)) * 100,
    y: 100 - ((point.value - min) / magnitude) * 100,
  });
  const path = points.map((point, index) => { const pointCoordinate = coordinate(point, index); return `${pointCoordinate.x},${pointCoordinate.y}`; }).join(" ");
  const activePoint = activeIndex === null ? null : points[activeIndex];
  const activeCoordinate = activePoint && activeIndex !== null ? coordinate(activePoint, activeIndex) : null;
  const selectByPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - bounds.left) / Math.max(1, bounds.width)));
    setActiveIndex(Math.round(ratio * (points.length - 1)));
  };
  const moveSelection = (direction: -1 | 1) => setActiveIndex(current => Math.min(points.length - 1, Math.max(0, (current ?? points.length - 1) + direction)));

  return <div className="chart-shell">
    <svg
      className={`sparkline ${positive ? "up" : "down"}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      role="img"
      tabIndex={0}
      aria-label={`${label} ${valueLabel}走勢圖；可用左右方向鍵檢視資料點`}
      onPointerMove={selectByPointer}
      onPointerLeave={() => setActiveIndex(null)}
      onFocus={() => setActiveIndex(points.length - 1)}
      onBlur={() => setActiveIndex(null)}
      onKeyDown={event => {
        if (event.key === "ArrowLeft") { event.preventDefault(); moveSelection(-1); }
        if (event.key === "ArrowRight") { event.preventDefault(); moveSelection(1); }
      }}
    >
      <polyline points={path} fill="none" vectorEffect="non-scaling-stroke" />
      {activeCoordinate ? <circle cx={activeCoordinate.x} cy={activeCoordinate.y} r="4" vectorEffect="non-scaling-stroke" /> : null}
    </svg>
    <p className="chart-tooltip" aria-live="polite">{activePoint ? <><strong>{activePoint.date}</strong><span>{valueLabel} {formatChartValue(activePoint.value)}</span></> : <span>移動滑鼠或使用左右方向鍵查看日期與精確數值</span>}</p>
  </div>;
}

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
  const [reloadStatus, setReloadStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
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

  const loadDashboard = async (manual = false) => {
    if (manual) setReloadStatus("loading");
    else setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${staticDashboardUrl()}?cache-bust=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`資料讀取失敗（${response.status}）`);
      const payload: unknown = await response.json();
      if (!isStaticDashboard(payload)) throw new Error("靜態資料格式不完整");
      setDashboard(payload);
      if (manual) setReloadStatus("success");
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "無法讀取靜態資料");
      if (manual) setReloadStatus("error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { void loadDashboard(); }, []);
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
  const downloadCsv = (content: string, fileName: string) => {
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  return <main className="shell">
    <header className="hero">
      <div><p className="eyebrow">PUBLIC STATIC EDITION</p><h1>投資儀表板</h1><p>全球市場、基金淨值與財經 RSS，一天更新一次。</p></div>
      <div className="hero-tools">
        <button className="reload-button" onClick={() => void loadDashboard(true)} disabled={reloadStatus === "loading"}>{reloadStatus === "loading" ? "讀取中…" : "重新讀取最新資料"}</button>
        <button className="theme-toggle" aria-label={`切換為${theme === "dark" ? "淺色" : "深色"}模式`} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}><span className="theme-symbol" aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span><span>{theme === "dark" ? "淺色模式" : "深色模式"}</span></button>
        <div className="update-chip"><strong>資料更新</strong><span>{formatDate(dashboard?.generatedAt ?? null)}</span></div>
      </div>
    </header>
    <section className="static-note" aria-label="靜態版限制">
      <div><strong>靜態公開版</strong><span>資料由 GitHub Actions 每日台北時間 08:00 產生。重新讀取按鈕只會取得最新「已發布」快照，不會直接向市場來源抓取資料；自選、新聞收藏與稍後閱讀僅保存在此瀏覽器。</span></div>
      <details className="admin-update-guide"><summary>管理者立即更新資料</summary><ol><li>開啟 <a href="https://github.com/robbpat673673-byte/investment-dashboard-pages/actions/workflows/update-static-pages.yml" target="_blank" rel="noreferrer">GitHub Actions 工作流程</a>。</li><li>選擇「Run workflow」並確認 `main` 分支。</li><li>完成後回到本站按「重新讀取最新資料」。僅具儲存庫寫入權限的管理者可觸發此操作。</li></ol></details>
    </section>
    {reloadStatus !== "idle" ? <p className={`reload-status ${reloadStatus}`} role="status">{reloadStatus === "loading" ? "正在重新讀取已發布資料…" : reloadStatus === "success" ? `已重新讀取最新已發布資料；資料快照時間為 ${formatDate(dashboard?.generatedAt ?? null)}。` : "重新讀取失敗，請確認網路後再試。"}</p> : null}
    {error ? <section className="error">{error}。請稍後重新整理，或請管理者在 GitHub Actions 手動執行「更新並發布靜態資料」。</section> : null}
    {isLoading && !dashboard ? <DashboardSkeleton /> : null}
    {dashboard ? <>
      {dashboard.errors.length ? <section className="warning"><strong>部分來源本次未更新：</strong>{dashboard.errors.slice(0, 4).join("；")}</section> : null}
      <section className="section">
        <div className="section-heading"><div><p className="eyebrow">MARKETS</p><h2>全球市場</h2></div><div className="section-actions"><div className="range-controls">{(["1m", "3m", "6m", "1y"] as HistoryRange[]).map(item => <button key={item} className={range === item ? "active" : ""} onClick={() => setRange(item)}>{item.toUpperCase()}</button>)}</div><button className="export-button" onClick={() => downloadCsv(createMarketsCsv(dashboard.markets), "investment-dashboard-markets.csv")}>匯出市場 CSV</button></div></div>
        <div className="market-grid">{dashboard.markets.slice(0, 8).map(market => <article className="market-card" key={market.ticker}><div className="card-head"><span>{market.name}</span><small>{market.quoteDate}</small></div><strong>{market.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}</strong><div className={`change ${market.percentChange >= 0 ? "positive" : "negative"}`}>{formatPct(market.percentChange)} <span>{market.change.toFixed(2)}</span></div><Sparkline points={filterHistoryRange(market.history, range)} positive={market.percentChange >= 0} label={market.name} valueLabel="價格" /></article>)}</div>
      </section>
      <section className="section">
        <div className="section-heading fund-heading"><div><p className="eyebrow">FUNDS</p><h2>基金淨值與區間報酬</h2></div><div className="fund-controls"><button className={fundType === "domestic" ? "active" : ""} onClick={() => setFundType("domestic")}>國內基金</button><button className={fundType === "foreign" ? "active" : ""} onClick={() => setFundType("foreign")}>國際基金</button><button className={favoritesOnly ? "active" : ""} onClick={() => setFavoritesOnly(!favoritesOnly)}>我的自選</button><select aria-label="基金排序" value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="year">近一年報酬</option><option value="month">近一月報酬</option><option value="name">基金名稱</option></select><input aria-label="搜尋基金" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜尋名稱或代碼" /><button className="export-button" onClick={() => downloadCsv(createFundsCsv(filteredFunds), "investment-dashboard-funds.csv")}>匯出篩選基金 CSV</button></div></div>
        <div className="fund-grid">{filteredFunds.map(fund => <article className="fund-card" key={fund.id}><div className="card-head"><div><strong>{fund.name}</strong><small>{fund.code ?? fund.id} · {fund.currency}</small></div><div className="fund-head-actions"><button className={favorites.includes(fund.id) ? "saved" : ""} aria-label={`切換 ${fund.name} 自選`} onClick={() => toggleItem(fund.id, favorites, setFavorites)}>{favorites.includes(fund.id) ? "★" : "☆"}</button><span>{fund.asOfDate}</span></div></div><div className="nav-value">{fund.nav.toLocaleString("en-US", { maximumFractionDigits: 4 })}<small>淨值</small></div><Sparkline points={filterHistoryRange(fund.history, range)} positive={(fund.returns.year ?? 0) >= 0} label={fund.name} valueLabel="淨值" /><div className="returns">{periods.map(([key, label]) => <span key={key}><small>{label}</small><b className={(fund.returns[key] ?? 0) >= 0 ? "positive" : "negative"}>{formatPct(fund.returns[key])}</b></span>)}</div></article>)}</div>{filteredFunds.length === 0 ? <p className="empty">沒有符合條件的基金。</p> : null}
      </section>
      <section className="section news-section"><div className="section-heading fund-heading"><div><p className="eyebrow">RSS NEWS</p><h2>財經即時新聞</h2></div><div className="news-controls"><select aria-label="新聞來源篩選" value={newsSource} onChange={event => setNewsSource(event.target.value)}><option value="all">全部來源</option>{dashboard.sourceHealth.map(source => <option key={source.source} value={source.source}>{source.source}</option>)}</select><input aria-label="搜尋新聞" value={newsQuery} onChange={event => setNewsQuery(event.target.value)} placeholder="搜尋新聞標題或摘要" /></div></div><div className="news-trust-grid" aria-label="新聞來源與更新資訊"><article className="trust-card"><span className="trust-label">已納入來源</span><strong>{new Set(dashboard.news.map(news => news.source)).size} 個來源</strong><small>依來源新鮮度與配額整理</small></article><article className="trust-card"><span className="trust-label">最新新聞時間</span><strong>{formatDate(latestNewsAt)}</strong><small>依文章發布時間排序</small></article><article className="trust-card"><span className="trust-label">資料同步時間</span><strong>{formatDate(dashboard.generatedAt)}</strong><small>GitHub Actions 公開資料快照</small></article></div>{sourceDiagnostics.length ? <details className="source-diagnostics"><summary><span><strong>資料來源診斷</strong><small>{sourceDiagnostics.length} 項需注意</small></span><span className="diagnostic-toggle">展開明細</span></summary><div className="diagnostic-grid">{sourceDiagnostics.map(item => <article className={`diagnostic-card ${item.status}`} key={item.key}><div><span className="diagnostic-status">{item.status === "error" ? "載入失敗" : "沒有新資料"}</span><strong>{item.label}</strong></div><p>{item.detail}</p><footer><span>本次接受 {item.acceptedCount ?? 0} 則</span>{item.latencyMs !== undefined ? <span>延遲 {item.latencyMs} ms</span> : null}<span>檢查於 {formatDate(dashboard.generatedAt)}</span></footer></article>)}</div></details> : null}<div className="news-list">{filteredNews.slice(0, 20).map(news => <article key={`${news.source}-${news.url}`}><a href={news.url} target="_blank" rel="noreferrer"><div className="news-meta"><span className="source-badge">來源：{news.source}</span><time dateTime={news.publishedAt}>發布：{formatDate(news.publishedAt)}</time></div><strong>{news.title}</strong>{news.summary ? <p>{news.summary}</p> : null}</a><div className="news-actions"><button className={savedNews.includes(news.url) ? "saved" : ""} onClick={() => toggleItem(news.url, savedNews, setSavedNews)}>{savedNews.includes(news.url) ? "已收藏" : "收藏"}</button><button className={readLater.includes(news.url) ? "saved" : ""} onClick={() => toggleItem(news.url, readLater, setReadLater)}>{readLater.includes(news.url) ? "已加入稍後閱讀" : "稍後閱讀"}</button></div></article>)}</div>{filteredNews.length === 0 ? <p className="empty">沒有符合條件的新聞。</p> : null}<div className="health">{dashboard.sourceHealth.map(source => <span key={source.source} className={source.status}>{source.source}：{source.status}（{source.acceptedCount}）</span>)}</div></section>
    </> : null}
  </main>;
}
