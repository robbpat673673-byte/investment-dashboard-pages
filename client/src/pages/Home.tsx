import { trpc } from "@/lib/trpc";
import { filterFunds, type FundScope } from "@/lib/fundFilters";
import { moveMarketCard, orderMarketCards } from "@/lib/marketCardOrder";
import { FAVORITE_FUNDS_STORAGE_KEY, createFavoriteExport, parseFavoriteFundIds, parseFavoriteImport, sortFundsByReturn, toggleFavoriteFundId, type FundSortKey } from "@/lib/fundPreferences";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ObservatoryPanel } from "@/components/ObservatoryPanel";
import { ObservatoryAlertHistory } from "@/components/ObservatoryAlertHistory";
import React, { useEffect, useMemo, useState } from "react";

type TabKey = "asia" | "domestic" | "foreign" | "performance" | "news" | "observatory" | "alertHistory";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "asia", label: "全球市場" },
  { key: "domestic", label: "國內基金" },
  { key: "foreign", label: "國際基金" },
  { key: "performance", label: "漲跌幅" },
  { key: "news", label: "財經即時新聞" },
  { key: "observatory", label: "觀測站" },
  { key: "alertHistory", label: "警示歷史" },
];

function initialTabFromUrl(): TabKey {
  if (typeof window === "undefined") return "asia";
  const requested = new URLSearchParams(window.location.search).get("tab");
  return tabs.some(tab => tab.key === requested) ? requested as TabKey : "asia";
}

const periodLabels = [
  ["week", "一週"],
  ["month", "一月"],
  ["quarter", "三月"],
  ["halfYear", "半年"],
  ["year", "一年"],
] as const;

const fundSortOptions: Array<{ value: FundSortKey; label: string }> = [
  { value: "default", label: "預設排序" },
  { value: "week:desc", label: "一週報酬：高至低" },
  { value: "week:asc", label: "一週報酬：低至高" },
  { value: "month:desc", label: "一月報酬：高至低" },
  { value: "month:asc", label: "一月報酬：低至高" },
  { value: "quarter:desc", label: "三月報酬：高至低" },
  { value: "quarter:asc", label: "三月報酬：低至高" },
  { value: "halfYear:desc", label: "半年報酬：高至低" },
  { value: "halfYear:asc", label: "半年報酬：低至高" },
  { value: "year:desc", label: "一年報酬：高至低" },
  { value: "year:asc", label: "一年報酬：低至高" },
  { value: "ytd:desc", label: "YTD 報酬：高至低" },
  { value: "ytd:asc", label: "YTD 報酬：低至高" },
];

function formatNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "--";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "--" : new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "2-digit", day: "2-digit" }).format(parsed);
}

function formatChartDate(value: Date | string | null | undefined) {
  if (!value) return "--";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "--" : new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "2-digit", month: "2-digit" }).format(parsed);
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "等待首次更新";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "等待首次更新" : new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(parsed);
}

function valueClass(value: number | null | undefined) {
  if (value === null || value === undefined) return "flat";
  return value > 0 ? "up" : value < 0 ? "down" : "flat";
}

function returnText(value: number | null | undefined) {
  if (value === null || value === undefined) return "--";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

type FundCardData = {
  id: number;
  name: string;
  code: string | null;
  fundType: "domestic" | "foreign";
  currency: string;
  nav: number | null;
  asOfDate: Date | string | null;
  history: Array<{ date: string; nav: number }>;
  annualRank: number | null;
  annualTotal: number;
  isin?: string | null;
  bankCode?: string | null;
  perf: Record<(typeof periodLabels)[number][0] | "ytd", number | null>;
};

type MarketItem = {
  ticker: string;
  name: string;
  price: number | null;
  change: number | null;
  percentChange: number | null;
  quoteDate: string | null;
  showAsCard: boolean;
};

const commodityTickers = new Set(["GC=F", "CL=F", "BZ=F", "HG=F", "NG=F"]);

function Sparkline({ history, annualReturn }: { history: FundCardData["history"]; annualReturn: number | null }) {
  if (history.length < 2) return <div className="sparkline-empty">一年期淨值資料不足</div>;
  const values = history.map(point => point.nav);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  const points = history.map((point, index) => {
    const x = (index / (history.length - 1)) * 100;
    const y = 92 - ((point.nav - minimum) / range) * 78;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  const area = `0,100 ${points} 100,100`;
  const trendClass = valueClass(annualReturn);
  return (
    <div className="sparkline-wrap" aria-label={`${formatChartDate(history[0]?.date)} 至 ${formatChartDate(history.at(-1)?.date)} 的一年期淨值走勢`}>
      <div className="sparkline-head"><span>近一年淨值走勢</span><span>{formatChartDate(history[0]?.date)} — {formatChartDate(history.at(-1)?.date)}</span></div>
      <svg className={`sparkline ${trendClass}`} viewBox="0 0 100 100" preserveAspectRatio="none" role="img">
        <line x1="0" x2="100" y1="50" y2="50" className="sparkline-guide" />
        <polygon points={area} className="sparkline-area" />
        <polyline points={points} className="sparkline-line" vectorEffect="non-scaling-stroke" />
        <circle cx="100" cy={points.split(" ").at(-1)?.split(",")[1] ?? "50"} r="2.3" className="sparkline-dot" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

function FundCard({ fund, isFavorite = false, onToggleFavorite }: { fund: FundCardData; isFavorite?: boolean; onToggleFavorite?: (id: number) => void }) {
  const annualReturn = fund.perf.year;
  const rankWidth = fund.annualRank && fund.annualTotal > 1 ? Math.max(8, ((fund.annualTotal - fund.annualRank) / (fund.annualTotal - 1)) * 100) : 50;
  return (
    <article className="fund-card">
      <div className="fund-card-head"><div><div className="fc-code">{fund.code || `境外 · ${fund.currency}`}</div><div className="fc-name">{fund.name}</div></div>{onToggleFavorite ? <button type="button" className={`favorite-toggle ${isFavorite ? "active" : ""}`} aria-pressed={isFavorite} onClick={() => onToggleFavorite(fund.id)}>{isFavorite ? "★ 已追蹤" : "☆ 加入自選"}</button> : null}</div>
      <div className="fc-price">{fund.currency === "TWD" ? "" : `${fund.currency} `}{formatNumber(fund.nav, fund.currency === "TWD" ? 2 : 4)}</div>
      <Sparkline history={fund.history} annualReturn={annualReturn} />
      <div className="fc-returns" aria-label={`${fund.name} 多期間報酬`}>
        {periodLabels.map(([key, label]) => (
          <div className="fc-period" key={key}>
            <span className="fc-period-label">{label}</span>
            <span className={`fc-period-value ${valueClass(fund.perf[key])}`}>{returnText(fund.perf[key])}</span>
          </div>
        ))}
      </div>
      <div className="annual-performance">
        <div className="annual-performance-head"><span>年度績效比較</span><strong className={valueClass(annualReturn)}>{returnText(annualReturn)}</strong></div>
        <div className="annual-meter" aria-label={`一年報酬率排名 ${fund.annualRank ?? "--"} / ${fund.annualTotal || "--"}`}><span className={`annual-meter-fill ${valueClass(annualReturn)}`} style={{ width: `${rankWidth}%` }} /></div>
        <div className="annual-performance-foot"><span>一年報酬率</span><span>{fund.annualRank ? `第 ${fund.annualRank} / ${fund.annualTotal} 名` : "排名資料不足"}</span></div>
      </div>
      <div className="fc-ts">淨值日期：{formatDate(fund.asOfDate)}</div>
      <a className="fund-detail-link" href={`/fund/${fund.id}`}>查看完整資料 <span aria-hidden="true">→</span></a>
    </article>
  );
}

function FundBrowsePanel({ funds, favoriteFunds, query, scope, currency, sortKey, currencies, importMessage, onQueryChange, onScopeChange, onCurrencyChange, onSortChange, onToggleFavorite, onClearFavorites, onExportFavorites, onImportFavorites }: {
  funds: FundCardData[];
  favoriteFunds: FundCardData[];
  query: string;
  scope: FundScope;
  currency: string;
  sortKey: FundSortKey;
  currencies: string[];
  importMessage: string | null;
  onQueryChange: (value: string) => void;
  onScopeChange: (value: FundScope) => void;
  onCurrencyChange: (value: string) => void;
  onSortChange: (value: FundSortKey) => void;
  onToggleFavorite: (id: number) => void;
  onClearFavorites: () => void;
  onExportFavorites: () => void;
  onImportFavorites: (file: File) => void;
}) {
  const scopeLabel = scope === "domestic" ? "國內基金" : scope === "foreign" ? "國際基金" : "全部基金";
  return <>
    <div className="sec-title">{scopeLabel} — 搜尋與篩選</div>
    <div className="fund-filter-bar" aria-label="基金搜尋與篩選">
      <label className="fund-search-field"><span>搜尋</span><input value={query} onChange={event => onQueryChange(event.target.value)} placeholder="名稱、代碼、ISIN 或銀行／通路代號" aria-label="搜尋基金名稱、代碼、ISIN 或銀行代號" /></label>
      <div className="fund-filter-group" aria-label="基金類型"><span className="filter-label">類型</span>{(["all", "domestic", "foreign"] as FundScope[]).map(value => <button className={`filter-chip ${scope === value ? "active" : ""}`} type="button" key={value} onClick={() => onScopeChange(value)}>{value === "all" ? "全部" : value === "domestic" ? "國內" : "國際"}</button>)}</div>
      <label className="fund-currency-field"><span>幣別</span><select value={currency} onChange={event => onCurrencyChange(event.target.value)} aria-label="篩選基金幣別"><option value="all">全部幣別</option>{currencies.map(item => <option value={item} key={item}>{item}</option>)}</select></label>
      <label className="fund-sort-field"><span>排序</span><select value={sortKey} onChange={event => onSortChange(event.target.value as FundSortKey)} aria-label="依區間報酬率排序">{fundSortOptions.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
      <span className="filter-result-count">顯示 {funds.length} 檔</span>
    </div>
    <p className="fund-hint">可依基金名稱、代碼、ISIN、銀行／通路代號、類型、幣別與不同區間報酬率交叉篩選；自選清單儲存在此瀏覽器，可匯出備份或匯入還原。</p>
    {favoriteFunds.length > 0 ? <section className="favorite-panel"><div className="favorite-panel-head"><strong>★ 自選追蹤清單</strong><span>{favoriteFunds.length} 檔</span><button type="button" onClick={onExportFavorites}>匯出 JSON</button><label className="favorite-import"><span>匯入 JSON</span><input type="file" accept="application/json,.json" onChange={event => { const file = event.target.files?.[0]; if (file) onImportFavorites(file); event.currentTarget.value = ""; }} /></label><button type="button" onClick={onClearFavorites}>清除自選</button></div>{importMessage ? <p className="favorite-import-message">{importMessage}</p> : null}<div className="fund-grid favorite-grid">{favoriteFunds.map(fund => <FundCard key={fund.id} fund={fund} isFavorite onToggleFavorite={onToggleFavorite} />)}</div></section> : <section className="favorite-empty">尚未加入自選基金；點選基金卡片右上角即可追蹤。<div className="favorite-empty-actions"><button type="button" onClick={onExportFavorites}>匯出空白清單</button><label className="favorite-import"><span>匯入 JSON</span><input type="file" accept="application/json,.json" onChange={event => { const file = event.target.files?.[0]; if (file) onImportFavorites(file); event.currentTarget.value = ""; }} /></label></div>{importMessage ? <p className="favorite-import-message">{importMessage}</p> : null}</section>}
    <section className="fund-metric-table-wrap"><div className="detail-section-title"><span>區間報酬快速比較</span><small>點擊欄位標題排序</small></div><div className="table-wrap"><table className="dtable fund-metric-table"><thead><tr><th className="left">基金</th>{(["month", "quarter", "ytd"] as const).map(period => { const label = period === "month" ? "近 1 月" : period === "quarter" ? "近 3 月" : "YTD"; const nextSort: FundSortKey = sortKey === `${period}:desc` ? `${period}:asc` : `${period}:desc`; return <th key={period}><button type="button" className="metric-sort-button" onClick={() => onSortChange(nextSort)}>{label}{sortKey.startsWith(`${period}:`) ? sortKey.endsWith("desc") ? " ↓" : " ↑" : " ↕"}</button></th>; })}</tr></thead><tbody>{funds.map(fund => <tr key={fund.id}><td className="left"><a className="metric-fund-link" href={`/fund/${fund.id}`}>{fund.code ?? "境外"} · {fund.name}</a></td><td className={valueClass(fund.perf.month)}>{returnText(fund.perf.month)}</td><td className={valueClass(fund.perf.quarter)}>{returnText(fund.perf.quarter)}</td><td className={valueClass(fund.perf.ytd)}>{returnText(fund.perf.ytd)}</td></tr>)}</tbody></table></div></section>
    {funds.length === 0 ? <div className="empty-inline">沒有符合條件的基金，請調整搜尋字詞或篩選條件。</div> : <div className="fund-grid">{funds.map(fund => <FundCard key={fund.id} fund={fund} isFavorite={favoriteFunds.some(item => item.id === fund.id)} onToggleFavorite={onToggleFavorite} />)}</div>}
  </>;
}

function MarketCards({ market, cardOrder, onCardOrderChange }: { market: MarketItem[]; cardOrder: string[]; onCardOrderChange: (nextOrder: string[]) => void }) {
  const [draggedTicker, setDraggedTicker] = useState<string | null>(null);
  const cards = orderMarketCards(market, cardOrder);
  if (cards.length === 0) return <div className="empty-inline">等待每日行情資料更新。</div>;
  const reorder = (targetTicker: string) => {
    if (!draggedTicker || draggedTicker === targetTicker) return;
    onCardOrderChange(moveMarketCard(cards.map(item => item.ticker), draggedTicker, targetTicker));
    setDraggedTicker(null);
  };
  return (
    <div className="market-card-zone">
      <div className="market-card-controls"><span>按住卡片拖曳即可排序；此瀏覽器會記住你的順序。</span><button type="button" className="sort-reset" onClick={() => onCardOrderChange([])}>重設排序</button></div>
      <div className="index-bar" aria-label="可拖曳排序的市場行情卡片">
        {cards.map(item => (
          <article className={`idx-card ${draggedTicker === item.ticker ? "dragging" : ""}`} key={item.ticker} draggable onDragStart={() => setDraggedTicker(item.ticker)} onDragOver={event => event.preventDefault()} onDrop={() => reorder(item.ticker)} onDragEnd={() => setDraggedTicker(null)}>
            <span className="idx-drag-handle" aria-hidden="true">⋮⋮</span><div className="idx-name">{item.name}</div><div className={`idx-val ${valueClass(item.percentChange)}`}>{formatNumber(item.price)}</div><div className={`idx-chg ${valueClass(item.percentChange)}`}>{item.change === null ? "--" : `${item.change > 0 ? "+" : ""}${formatNumber(item.change)}`} ({returnText(item.percentChange)})</div><div className="idx-ts">{item.quoteDate || "--"}</div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTabFromUrl);
  const [fundQuery, setFundQuery] = useState("");
  const [fundScope, setFundScope] = useState<FundScope>(() => initialTabFromUrl() === "foreign" ? "foreign" : "domestic");
  const [fundCurrency, setFundCurrency] = useState("all");
  const [fundSortKey, setFundSortKey] = useState<FundSortKey>("default");
  const [favoriteFundIds, setFavoriteFundIds] = useState<number[]>(() => typeof window === "undefined" ? [] : parseFavoriteFundIds(window.localStorage.getItem(FAVORITE_FUNDS_STORAGE_KEY)));
  const [favoriteImportMessage, setFavoriteImportMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [marketCardOrder, setMarketCardOrder] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(window.localStorage.getItem("investment-dashboard-market-order") ?? "[]") as string[]; } catch { return []; }
  });
  const { data, isLoading, isFetching, refetch } = trpc.dashboard.get.useQuery(undefined, { refetchInterval: 60_000 });

  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 1_000); return () => window.clearInterval(timer); }, []);

  const selectTab = (tab: TabKey) => {
    setActiveTab(tab);
    if (tab === "domestic" || tab === "foreign") setFundScope(tab);
  };
  const saveMarketCardOrder = (nextOrder: string[]) => {
    setMarketCardOrder(nextOrder);
    if (nextOrder.length === 0) window.localStorage.removeItem("investment-dashboard-market-order");
    else window.localStorage.setItem("investment-dashboard-market-order", JSON.stringify(nextOrder));
  };
  const saveFavoriteFundIds = (nextIds: number[]) => {
    setFavoriteFundIds(nextIds);
    if (nextIds.length === 0) window.localStorage.removeItem(FAVORITE_FUNDS_STORAGE_KEY);
    else window.localStorage.setItem(FAVORITE_FUNDS_STORAGE_KEY, JSON.stringify(nextIds));
  };
  const exportFavorites = () => {
    const blob = new Blob([createFavoriteExport(favoriteFundIds)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "investment-dashboard-favorites.json"; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); setFavoriteImportMessage(`已匯出 ${favoriteFundIds.length} 檔自選基金。`);
  };
  const importFavorites = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const imported = parseFavoriteImport(String(reader.result ?? ""));
      if (!imported) { setFavoriteImportMessage("匯入失敗：請選擇由本儀表板匯出的 JSON 備份檔。 "); return; }
      const knownIds = new Set(allFunds.map(fund => fund.id)); const restored = imported.fundIds.filter(id => knownIds.has(id)); saveFavoriteFundIds(restored); setFavoriteImportMessage(`已還原 ${restored.length} 檔自選基金${imported.fundIds.length !== restored.length ? "；已略過目前不存在的基金。" : "。"}`);
    };
    reader.onerror = () => setFavoriteImportMessage("匯入失敗：無法讀取備份檔。 "); reader.readAsText(file, "utf-8");
  };
  const weeklyRanking = useMemo(() => {
    const all = [...(data?.domesticFunds ?? []), ...(data?.foreignFunds ?? [])];
    return all.sort((left, right) => (right.perf.week ?? -Infinity) - (left.perf.week ?? -Infinity));
  }, [data]);
  const allFunds = useMemo(() => [...(data?.domesticFunds ?? []), ...(data?.foreignFunds ?? [])] as FundCardData[], [data]);
  const availableCurrencies = useMemo(() => Array.from(new Set(allFunds.map(fund => fund.currency))).sort(), [allFunds]);
  const filteredFunds = useMemo(() => sortFundsByReturn(filterFunds(allFunds, { query: fundQuery, scope: fundScope, currency: fundCurrency }), fundSortKey), [allFunds, fundQuery, fundScope, fundCurrency, fundSortKey]);
  const favoriteFunds = useMemo(() => allFunds.filter(fund => favoriteFundIds.includes(fund.id)), [allFunds, favoriteFundIds]);
  const sidebarCommodities = data?.market.filter(item => commodityTickers.has(item.ticker)) ?? [];
  const sidebarStocks = data?.market.filter(item => !item.showAsCard && !commodityTickers.has(item.ticker)) ?? [];
  const sidebarDomestic = data?.domesticFunds.filter(fund => ["NOM006", "ALI006", "NOM008"].includes(fund.code ?? "")) ?? [];
  const sidebarForeign = data?.foreignFunds.slice(0, 2) ?? [];
  const dashboardStatus = data?.lastRefresh?.status === "failed" ? "更新失敗" : data?.lastRefresh?.status === "partial" ? "部分資料更新" : "每日自動更新";

  return <div className="shell">
    <header className="topbar"><div className="brand"><span className="brand-dot" />投資儀表板<span className="public-label">PUBLIC</span></div><div className="topbar-right"><span id="last-update">{dashboardStatus}：{formatDateTime(data?.lastRefresh?.finishedAt)}</span><span id="globalTime">{now.toLocaleTimeString("zh-TW", { hour12: false })}</span><ThemeToggle /><button className="refresh-btn" onClick={() => refetch()} disabled={isFetching}>{isFetching ? "更新中" : "↻ 更新"}</button></div></header>
    <aside className="sidebar" aria-label="市場摘要">
      <div className="sb-label">原物料</div>{sidebarCommodities.map(item => <button className="sb-item" key={item.ticker} onClick={() => selectTab("asia")}><div><div className="sb-code">{item.ticker}</div><div className="sb-name">{item.name}</div><div className="sb-ts">{item.quoteDate || "--"}</div></div><div><div className={`sb-price ${valueClass(item.percentChange)}`}>{formatNumber(item.price)}</div><div className={`sb-chg ${valueClass(item.percentChange)}`}>{returnText(item.percentChange)}</div></div></button>)}
      <div className="sb-label">台股個股</div>{sidebarStocks.map(item => <button className="sb-item" key={item.ticker} onClick={() => selectTab("asia")}><div><div className="sb-code">{item.ticker}</div><div className="sb-name">{item.name}</div><div className="sb-ts">{item.quoteDate || "--"}</div></div><div><div className={`sb-price ${valueClass(item.percentChange)}`}>{formatNumber(item.price)}</div><div className={`sb-chg ${valueClass(item.percentChange)}`}>{returnText(item.percentChange)}</div></div></button>)}
      <div className="sb-label">國內基金</div>{sidebarDomestic.map(fund => <button className="sb-item" key={fund.id} onClick={() => selectTab("domestic")}><div><div className="sb-code">{fund.code}</div><div className="sb-name">{fund.name.replace("基金", "")}</div><div className="sb-ts">{formatDate(fund.asOfDate)}</div></div><div className="sb-price">{formatNumber(fund.nav)}</div></button>)}
      <div className="sb-label">國際基金</div>{sidebarForeign.map(fund => <button className="sb-item" key={fund.id} onClick={() => selectTab("foreign")}><div><div className="sb-code">境外</div><div className="sb-name">{fund.name.replace("基金", "")}</div><div className="sb-ts">{formatDate(fund.asOfDate)}</div></div><div className="sb-price">{formatNumber(fund.nav, 4)}</div></button>)}
    </aside>
    <main className="main">
      <nav className="tab-nav" aria-label="投資儀表板頁籤">{tabs.map(tab => <button className={`tab ${activeTab === tab.key ? "active" : ""}`} key={tab.key} onClick={() => selectTab(tab.key)}>{tab.label}</button>)}</nav>
      {isLoading ? <div className="loading-state">正在讀取公開資料庫…</div> : null}
      {activeTab === "asia" && <section className="panel active"><MarketCards market={data?.market ?? []} cardOrder={marketCardOrder} onCardOrderChange={saveMarketCardOrder} /><div className="sec-title">台股個股 / 全球指數</div><div className="table-wrap"><table className="dtable"><thead><tr><th>代碼</th><th className="left">名稱</th><th>現價</th><th>漲跌</th><th>漲跌幅</th><th>更新時間</th><th>狀態</th></tr></thead><tbody>{(data?.market ?? []).map(item => <tr key={item.ticker}><td><span className="t-code">{item.ticker}</span></td><td className="left"><span className="t-name">{item.name}</span></td><td><span className={`t-price ${valueClass(item.percentChange)}`}>{formatNumber(item.price)}</span></td><td><span className={`t-chg ${valueClass(item.percentChange)}`}>{item.change === null ? "--" : `${item.change > 0 ? "+" : ""}${formatNumber(item.change)}`}</span></td><td><span className={`badge badge-${valueClass(item.percentChange)}`}>{returnText(item.percentChange)}</span></td><td className="t-ts"><span className="ts-dot live" />{item.quoteDate || "--"}</td><td><span className="badge badge-live">已更新</span></td></tr>)}</tbody></table></div></section>}
      {(activeTab === "domestic" || activeTab === "foreign") && <section className="panel active"><FundBrowsePanel funds={filteredFunds} favoriteFunds={favoriteFunds} query={fundQuery} scope={fundScope} currency={fundCurrency} sortKey={fundSortKey} currencies={availableCurrencies} importMessage={favoriteImportMessage} onQueryChange={setFundQuery} onScopeChange={setFundScope} onCurrencyChange={setFundCurrency} onSortChange={setFundSortKey} onToggleFavorite={id => saveFavoriteFundIds(toggleFavoriteFundId(favoriteFundIds, id))} onClearFavorites={() => saveFavoriteFundIds([])} onExportFavorites={exportFavorites} onImportFavorites={importFavorites} /></section>}
      {activeTab === "performance" && <section className="panel active"><MarketCards market={data?.market ?? []} cardOrder={marketCardOrder} onCardOrderChange={saveMarketCardOrder} /><div className="sec-title">一週、一月、三月、YTD 與一年漲跌幅排行</div><div className="table-wrap"><table className="dtable"><thead><tr><th>代碼</th><th className="left">名稱</th><th>淨值</th><th>日期</th><th>一週</th><th>近 1 月</th><th>近 3 月</th><th>YTD</th><th>一年</th><th>年度排名</th></tr></thead><tbody>{weeklyRanking.map(fund => <tr key={fund.id}><td><span className="t-code">{fund.code || "境外"}</span></td><td className="left"><span className="t-name">{fund.name}</span></td><td><span className="t-price">{fund.currency === "TWD" ? "" : `${fund.currency} `}{formatNumber(fund.nav, fund.currency === "TWD" ? 2 : 4)}</span></td><td className="t-ts">{formatDate(fund.asOfDate)}</td><td><span className={`badge badge-${valueClass(fund.perf.week)}`}>{returnText(fund.perf.week)}</span></td><td><span className={`badge badge-${valueClass(fund.perf.month)}`}>{returnText(fund.perf.month)}</span></td><td><span className={`badge badge-${valueClass(fund.perf.quarter)}`}>{returnText(fund.perf.quarter)}</span></td><td><span className={`badge badge-${valueClass(fund.perf.ytd)}`}>{returnText(fund.perf.ytd)}</span></td><td><span className={`badge badge-${valueClass(fund.perf.year)}`}>{returnText(fund.perf.year)}</span></td><td className="t-ts">{fund.annualRank ? `${fund.annualRank} / ${fund.annualTotal}` : "--"}</td></tr>)}</tbody></table></div></section>}
      {activeTab === "news" && <section className="panel active"><div className="sec-title">財經即時新聞</div><div className="news-list">{(data?.news ?? []).length === 0 ? <div className="empty-inline">等待每日 RSS 更新。</div> : (data?.news ?? []).map(item => <article className="news-item" key={item.id}><a className="news-title" href={item.url} target="_blank" rel="noreferrer">{item.title}</a>{item.summary ? <p className="news-body">{item.summary}</p> : null}<div className="news-meta"><span>{formatDateTime(item.publishedAt)}</span><span>{item.source}</span></div></article>)}</div></section>}
      {activeTab === "observatory" && <ObservatoryPanel data={data?.observatory} onOpenAlertHistory={() => selectTab("alertHistory")} />}
      {activeTab === "alertHistory" && <ObservatoryAlertHistory onBack={() => selectTab("observatory")} />}
    </main>
  </div>;
}
