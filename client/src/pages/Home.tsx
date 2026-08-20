import { trpc } from "@/lib/trpc";
import { filterFunds, type FundScope } from "@/lib/fundFilters";
import { moveMarketCard, orderMarketCards } from "@/lib/marketCardOrder";
import { FAVORITE_FUNDS_STORAGE_KEY, createFavoriteExport, parseFavoriteFundIds, parseFavoriteImport, sortFundsByReturn, toggleFavoriteFundId, type FundSortKey } from "@/lib/fundPreferences";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NEWS_PREFERENCES_KEY, filterNewsByPreference, parseNewsPreferences, serializeNewsPreferences, toggleNewsPreference, type NewsPreferenceState } from "@/lib/newsPreferences";
import { ObservatoryPanel } from "@/components/ObservatoryPanel";
import { ObservatoryAlertHistory } from "@/components/ObservatoryAlertHistory";
import { NewsLibraryPanel } from "@/components/NewsLibraryPanel";
import React, { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { buildNewsHealthTrend, filterNewsHealthSources, type NewsHealthTrendPoint } from "@/lib/newsHealthTrend";
import { classifyDataFreshness } from "@/lib/dataFreshness";

type TabKey = "asia" | "domestic" | "foreign" | "performance" | "news" | "observatory" | "alertHistory" | "newsLibrary";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "asia", label: "全球市場" },
  { key: "domestic", label: "國內基金" },
  { key: "foreign", label: "國際基金" },
  { key: "performance", label: "漲跌幅" },
  { key: "news", label: "財經即時新聞" },
  { key: "observatory", label: "觀測站" },
  { key: "alertHistory", label: "警示歷史" },
  { key: "newsLibrary", label: "新聞管理" },
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

function formatQuoteDate(value: string | null | undefined, now = new Date()) {
  if (!value) return "--";
  const shortDate = value.match(/^(\d{2})\/(\d{2})$/);
  if (shortDate) return `${now.getFullYear()}/${shortDate[1]}/${shortDate[2]}`;
  return formatDate(value);
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

function newsPreferenceId(item: { id: number; url: string; title: string }) { return item.url || `${item.id}:${item.title}`; }

function newsCategory(source: string, title: string) {
  const text = `${source} ${title}`;
  if (/基金|債券|匯率/.test(text)) return "基金／債券";
  if (/台灣|台股/.test(text)) return "台灣";
  if (/全球|美股|市場|MarketWatch|CNBC|華爾街日報|Financial Times/.test(text)) return "市場";
  if (/利率|通膨|央行|GDP|總經/.test(text)) return "總經";
  return "其他";
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
  totalReturn: { available: boolean; reason: string; week: number | null; month: number | null; quarter: number | null; halfYear: number | null; year: number | null; ytd: number | null };
};

type MarketItem = {
  ticker: string;
  name: string;
  price: number | null;
  change: number | null;
  percentChange: number | null;
  quoteDate: string | null;
  quoteStatus: "收盤" | "盤中";
  showAsCard: boolean;
};

type NewsSourceStatus = {
  url: string;
  source: string;
  status: "fresh" | "stale" | "empty" | "error";
  acceptedCount: number;
  latencyMs: number;
  detail?: string;
};

type NewsHealthHistoryPoint = NewsHealthTrendPoint;

const sourceStatusLabel: Record<NewsSourceStatus["status"], string> = { fresh: "新鮮", stale: "過舊", empty: "無內容", error: "錯誤" };

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

function FundCard({ fund, now, isFavorite = false, onToggleFavorite }: { fund: FundCardData; now: Date; isFavorite?: boolean; onToggleFavorite?: (id: number) => void }) {
  const annualReturn = fund.perf.year;
  const freshness = classifyDataFreshness(fund.asOfDate, now, fund.fundType === "foreign" ? "foreign-fund" : "domestic-fund");
  const rankWidth = fund.annualRank && fund.annualTotal > 1 ? Math.max(8, ((fund.annualTotal - fund.annualRank) / (fund.annualTotal - 1)) * 100) : 50;
  return (
    <article className="fund-card">
      <div className="fund-card-head"><div><div className="fc-code">{fund.code || `境外 · ${fund.currency}`}</div><div className="fc-name">{fund.name}</div></div>{onToggleFavorite ? <button type="button" className={`favorite-toggle ${isFavorite ? "active" : ""}`} aria-pressed={isFavorite} onClick={() => onToggleFavorite(fund.id)}>{isFavorite ? "★ 已追蹤" : "☆ 加入自選"}</button> : null}</div>
      <div className="fc-price">{fund.currency === "TWD" ? "" : `${fund.currency} `}{formatNumber(fund.nav, fund.currency === "TWD" ? 2 : 4)}</div>
      <Sparkline history={fund.history} annualReturn={annualReturn} />
      <div className="fc-return-groups" aria-label={`${fund.name} 純淨值與含息總報酬`}>
        <div className="fc-return-group"><div className="fc-return-group-title">純淨值報酬</div><div className="fc-returns">{periodLabels.map(([key, label]) => <div className="fc-period" key={key}><span className="fc-period-label">{label}</span><span className={`fc-period-value ${valueClass(fund.perf[key])}`}>{returnText(fund.perf[key])}</span></div>)}</div></div>
        <div className="fc-return-group"><div className="fc-return-group-title">含息總報酬</div>{fund.totalReturn.available ? <div className="fc-returns">{periodLabels.map(([key, label]) => <div className="fc-period" key={key}><span className="fc-period-label">{label}</span><span className={`fc-period-value ${valueClass(fund.totalReturn[key])}`}>{returnText(fund.totalReturn[key])}</span></div>)}</div> : <div className="fc-total-return-unavailable">{fund.totalReturn.reason}</div>}</div>
      </div>
      <div className="annual-performance">
        <div className="annual-performance-head"><span>年度績效比較</span><strong className={valueClass(annualReturn)}>{returnText(annualReturn)}</strong></div>
        <div className="annual-meter" aria-label={`一年報酬率排名 ${fund.annualRank ?? "--"} / ${fund.annualTotal || "--"}`}><span className={`annual-meter-fill ${valueClass(annualReturn)}`} style={{ width: `${rankWidth}%` }} /></div>
        <div className="annual-performance-foot"><span>一年報酬率</span><span>{fund.annualRank ? `第 ${fund.annualRank} / ${fund.annualTotal} 名` : "排名資料不足"}</span></div>
      </div>
      <div className="fc-ts">資料截至：{formatDate(fund.asOfDate)} · {fund.fundType === "domestic" ? "淨值" : "境外基金淨值"} · <span className={`data-freshness ${freshness.kind}`}>{freshness.label}</span><small>{freshness.detail}</small></div>
      <a className="fund-detail-link" href={`/fund/${fund.id}`}>查看完整資料 <span aria-hidden="true">→</span></a>
    </article>
  );
}

function FundBrowsePanel({ funds, favoriteFunds, now, query, scope, currency, sortKey, currencies, importMessage, onQueryChange, onScopeChange, onCurrencyChange, onSortChange, onToggleFavorite, onClearFavorites, onExportFavorites, onImportFavorites }: {
  funds: FundCardData[];
  favoriteFunds: FundCardData[];
  now: Date;
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
    {favoriteFunds.length > 0 ? <section className="favorite-panel"><div className="favorite-panel-head"><strong>★ 自選追蹤清單</strong><span>{favoriteFunds.length} 檔</span><button type="button" onClick={onExportFavorites}>匯出 JSON</button><label className="favorite-import"><span>匯入 JSON</span><input type="file" accept="application/json,.json" onChange={event => { const file = event.target.files?.[0]; if (file) onImportFavorites(file); event.currentTarget.value = ""; }} /></label><button type="button" onClick={onClearFavorites}>清除自選</button></div>{importMessage ? <p className="favorite-import-message">{importMessage}</p> : null}<div className="fund-grid favorite-grid">{favoriteFunds.map(fund => <FundCard key={fund.id} fund={fund} now={now} isFavorite onToggleFavorite={onToggleFavorite} />)}</div></section> : <section className="favorite-empty">尚未加入自選基金；點選基金卡片右上角即可追蹤。<div className="favorite-empty-actions"><button type="button" onClick={onExportFavorites}>匯出空白清單</button><label className="favorite-import"><span>匯入 JSON</span><input type="file" accept="application/json,.json" onChange={event => { const file = event.target.files?.[0]; if (file) onImportFavorites(file); event.currentTarget.value = ""; }} /></label></div>{importMessage ? <p className="favorite-import-message">{importMessage}</p> : null}</section>}
    <section className="fund-metric-table-wrap"><div className="detail-section-title"><span>區間報酬快速比較</span><small>點擊欄位標題排序</small></div><div className="table-wrap"><table className="dtable fund-metric-table"><thead><tr><th className="left">基金</th>{(["month", "quarter", "ytd"] as const).flatMap(period => { const label = period === "month" ? "近 1 月" : period === "quarter" ? "近 3 月" : "YTD"; const nextSort: FundSortKey = sortKey === `${period}:desc` ? `${period}:asc` : `${period}:desc`; return [<th key={`${period}-nav`}><button type="button" className="metric-sort-button" onClick={() => onSortChange(nextSort)}>{label} 淨值{sortKey.startsWith(`${period}:`) ? sortKey.endsWith("desc") ? " ↓" : " ↑" : " ↕"}</button></th>, <th key={`${period}-total`}>{label} 含息</th>]; })}</tr></thead><tbody>{funds.map(fund => <tr key={fund.id}><td className="left"><a className="metric-fund-link" href={`/fund/${fund.id}`}>{fund.code ?? "境外"} · {fund.name}</a></td><td className={valueClass(fund.perf.month)}>{returnText(fund.perf.month)}</td><td className={valueClass(fund.totalReturn.month)}>{fund.totalReturn.available ? returnText(fund.totalReturn.month) : "--"}</td><td className={valueClass(fund.perf.quarter)}>{returnText(fund.perf.quarter)}</td><td className={valueClass(fund.totalReturn.quarter)}>{fund.totalReturn.available ? returnText(fund.totalReturn.quarter) : "--"}</td><td className={valueClass(fund.perf.ytd)}>{returnText(fund.perf.ytd)}</td><td className={valueClass(fund.totalReturn.ytd)}>{fund.totalReturn.available ? returnText(fund.totalReturn.ytd) : "--"}</td></tr>)}</tbody></table></div></section>
    {funds.length === 0 ? <div className="empty-inline">沒有符合條件的基金，請調整搜尋字詞或篩選條件。</div> : <div className="fund-grid">{funds.map(fund => <FundCard key={fund.id} fund={fund} now={now} isFavorite={favoriteFunds.some(item => item.id === fund.id)} onToggleFavorite={onToggleFavorite} />)}</div>}
  </>;
}

function NewsSourceHealth({ statuses, refreshedAt }: { statuses: NewsSourceStatus[]; refreshedAt: Date | string | null | undefined }) {
  return <section className="news-source-health" aria-label="新聞來源健康狀態"><div className="detail-section-title"><span>新聞來源健康狀態</span><small>{refreshedAt ? `最近刷新：${formatDateTime(refreshedAt)}` : "等待首次刷新"}</small></div>{statuses.length === 0 ? <div className="empty-inline">目前沒有可用的 RSS 來源狀態。</div> : <div className="news-source-health-grid">{statuses.map(item => <article className="news-source-health-card" key={item.url}><div className="news-source-health-head"><strong>{item.source}</strong><span className={`source-health-badge ${item.status}`}>{sourceStatusLabel[item.status]}</span></div><div className="news-source-health-meta"><span>接收 {item.acceptedCount} 則</span><span>{item.status === "fresh" ? "通過七天新鮮度" : item.detail ?? "來源尚無可用內容"}</span></div><a href={item.url} target="_blank" rel="noreferrer">開啟來源 ↗</a></article>)}</div>}</section>;
}

function NewsSourceHealthTrend({ history }: { history: NewsHealthHistoryPoint[] }) {
  const trend = useMemo(() => buildNewsHealthTrend(history), [history]);
  const [selectedSource, setSelectedSource] = useState("all");
  const colors = ["#2563eb", "#0f766e", "#b45309", "#be123c", "#7c3aed", "#475569", "#0891b2"];
  const visibleSources = filterNewsHealthSources(trend.sources, selectedSource);
  if (trend.sources.length === 0) return <section className="news-health-trend" aria-label="新聞來源歷史趨勢"><div className="detail-section-title"><span>歷史健康趨勢</span><small>成功率／延遲</small></div><div className="empty-inline">尚未累積足夠的來源刷新紀錄，完成下一次每日刷新後會開始顯示趨勢。</div></section>;
  return <section className="news-health-trend" style={{ overflowX: "hidden" }} aria-label="新聞來源歷史趨勢"><div className="detail-section-title"><span>歷史健康趨勢</span><small>最近 {trend.batchCount} 次刷新；成功率以 fresh 次數累計計算</small></div><div className="news-health-filter"><label htmlFor="news-health-source-filter">顯示來源</label><select id="news-health-source-filter" aria-label="選擇 RSS 趨勢來源" value={selectedSource} onChange={event => setSelectedSource(event.target.value)}><option value="all">全部來源</option>{trend.sources.map(source => <option key={source} value={source}>{source}</option>)}</select></div><div className="news-health-chart-block" data-series={visibleSources.join("|")} aria-label={`成功率圖表系列：${visibleSources.join("、") || "無"}`} style={{ overflowX: "hidden" }}><strong>各來源累積抓取成功率</strong><ResponsiveContainer width="100%" height={230}><LineChart data={trend.successData} margin={{ top: 8, right: 18, left: 0, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={28} /><YAxis domain={[0, 100]} tickFormatter={value => `${value}%`} tick={{ fontSize: 10 }} /><Tooltip formatter={(value: number) => `${value}%`} /><Legend wrapperStyle={{ fontSize: 11 }} />{visibleSources.map((source, index) => <Line key={source} type="monotone" dataKey={source} stroke={colors[index % colors.length]} strokeWidth={2} dot={false} connectNulls />)}</LineChart></ResponsiveContainer></div><div className="news-health-chart-block" data-series={visibleSources.join("|")} aria-label={`延遲圖表系列：${visibleSources.join("、") || "無"}`} style={{ overflowX: "hidden" }}><strong>各來源抓取延遲</strong><ResponsiveContainer width="100%" height={230}><LineChart data={trend.latencyData} margin={{ top: 8, right: 18, left: 0, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={28} /><YAxis tickFormatter={value => `${value}ms`} tick={{ fontSize: 10 }} /><Tooltip formatter={(value: number) => `${value} ms`} /><Legend wrapperStyle={{ fontSize: 11 }} />{visibleSources.map((source, index) => <Line key={source} type="monotone" dataKey={source} stroke={colors[index % colors.length]} strokeWidth={2} dot={false} connectNulls />)}</LineChart></ResponsiveContainer></div></section>;
}

function MarketCards({ market, now, cardOrder, onCardOrderChange }: { market: MarketItem[]; now: Date; cardOrder: string[]; onCardOrderChange: (nextOrder: string[]) => void }) {
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
        {cards.map(item => {
          const freshness = classifyDataFreshness(item.quoteDate, now, "market");
          return <article className={`idx-card ${draggedTicker === item.ticker ? "dragging" : ""}`} key={item.ticker} draggable onDragStart={() => setDraggedTicker(item.ticker)} onDragOver={event => event.preventDefault()} onDrop={() => reorder(item.ticker)} onDragEnd={() => setDraggedTicker(null)}>
            <span className="idx-drag-handle" aria-hidden="true">⋮⋮</span><div className="idx-name">{item.name}</div><div className={`idx-val ${valueClass(item.percentChange)}`}>{formatNumber(item.price)}</div><div className={`idx-chg ${valueClass(item.percentChange)}`}>{item.change === null ? "--" : `${item.change > 0 ? "+" : ""}${formatNumber(item.change)}`} ({returnText(item.percentChange)})</div><div className="idx-ts">資料截至：{formatQuoteDate(item.quoteDate, now)} · {item.quoteStatus} · <span className={`data-freshness ${freshness.kind}`}>{freshness.label}</span><small>{freshness.detail}</small></div>
          </article>;
        })}
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
  const [newsSource, setNewsSource] = useState("all");
  const [newsKeyword, setNewsKeyword] = useState("");
  const [newsCategoryFilter, setNewsCategoryFilter] = useState("all");
  const [newsPreferenceMode, setNewsPreferenceMode] = useState<"all" | "favorites" | "readLater">("all");
  const [newsSummaryById, setNewsSummaryById] = useState<Record<string, string>>({});
  const [newsSummaryErrorById, setNewsSummaryErrorById] = useState<Record<string, string>>({});
  const [newsSummaryLoadingId, setNewsSummaryLoadingId] = useState<string | null>(null);
  const [newsSummaryCopiedId, setNewsSummaryCopiedId] = useState<string | null>(null);
  const [newsSummaryCopyErrorById, setNewsSummaryCopyErrorById] = useState<Record<string, string>>({});
  const newsSummary = trpc.observatory.summarizeNews.useMutation({ onSuccess: (result, variables) => { const key = variables.id; setNewsSummaryById(current => ({ ...current, [key]: result.summary })); setNewsSummaryLoadingId(null); }, onError: (error, variables) => { const key = variables.id; setNewsSummaryErrorById(current => ({ ...current, [key]: error.message || "新聞摘要暫時無法產生" })); setNewsSummaryLoadingId(null); } });
  const [newsPreferences, setNewsPreferences] = useState<NewsPreferenceState>(() => parseNewsPreferences(typeof window === "undefined" ? null : window.localStorage.getItem(NEWS_PREFERENCES_KEY)));
  const [favoriteFundIds, setFavoriteFundIds] = useState<number[]>(() => typeof window === "undefined" ? [] : parseFavoriteFundIds(window.localStorage.getItem(FAVORITE_FUNDS_STORAGE_KEY)));
  const [favoriteImportMessage, setFavoriteImportMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [marketCardOrder, setMarketCardOrder] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(window.localStorage.getItem("investment-dashboard-market-order") ?? "[]") as string[]; } catch { return []; }
  });
  const { data, isLoading, isFetching, refetch } = trpc.dashboard.get.useQuery(undefined, { refetchInterval: 60_000 });
  const { data: newsHealthHistory = [] } = trpc.dashboard.newsSourceHealthHistory.useQuery({ limit: 14 }, { refetchInterval: 60_000 });

  useEffect(() => {
    window.localStorage.setItem(NEWS_PREFERENCES_KEY, serializeNewsPreferences(newsPreferences));
  }, [newsPreferences]);

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
  const toggleNewsFavorite = (id: string) => setNewsPreferences(current => ({ ...current, favorites: toggleNewsPreference(current.favorites, id) }));
  const toggleNewsReadLater = (id: string) => setNewsPreferences(current => ({ ...current, readLater: toggleNewsPreference(current.readLater, id) }));
  const requestNewsSummary = (item: { id: number; title: string; summary: string | null; source: string; publishedAt: Date | string | null }) => { const key = String(item.id); setNewsSummaryLoadingId(key); setNewsSummaryCopiedId(null); setNewsSummaryErrorById(current => { const next = { ...current }; delete next[key]; return next; }); newsSummary.mutate({ id: String(item.id), title: item.title, summary: item.summary ?? "", source: item.source, publishedAt: item.publishedAt ? new Date(item.publishedAt).toISOString() : null }); };
  const copyNewsSummary = async (id: string) => { const summary = newsSummaryById[id]; if (!summary) return; setNewsSummaryCopyErrorById(current => { const next = { ...current }; delete next[id]; return next; }); try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(summary); } else { const textarea = document.createElement("textarea"); textarea.value = summary; textarea.setAttribute("readonly", ""); textarea.style.position = "fixed"; textarea.style.opacity = "0"; document.body.appendChild(textarea); textarea.select(); const copied = document.execCommand("copy"); textarea.remove(); if (!copied) throw new Error("clipboard unavailable"); } setNewsSummaryCopiedId(id); window.setTimeout(() => setNewsSummaryCopiedId(current => current === id ? null : current), 1800); } catch { setNewsSummaryCopyErrorById(current => ({ ...current, [id]: "複製失敗，請手動選取摘要文字。" })); } };
  const newsSources = useMemo(() => Array.from(new Set((data?.news ?? []).map(item => item.source))).sort(), [data?.news]);
  const filteredNews = useMemo(() => { const base = (data?.news ?? []).filter(item => { const keyword = newsKeyword.trim().toLocaleLowerCase(); const matchesKeyword = !keyword || `${item.title} ${item.summary ?? ""} ${item.source}`.toLocaleLowerCase().includes(keyword); return matchesKeyword && (newsSource === "all" || item.source === newsSource) && (newsCategoryFilter === "all" || newsCategory(item.source, item.title) === newsCategoryFilter); }).sort((left, right) => new Date(right.publishedAt ?? 0).getTime() - new Date(left.publishedAt ?? 0).getTime()); return filterNewsByPreference(base.map(item => ({ ...item, preferenceId: newsPreferenceId(item) })), newsPreferences, newsPreferenceMode); }, [data?.news, newsSource, newsCategoryFilter, newsKeyword, newsPreferences, newsPreferenceMode]);
  const newsHighlights = filteredNews.slice(0, 3);
  const sidebarCommodities = data?.market.filter(item => commodityTickers.has(item.ticker)) ?? [];
  const sidebarStocks = data?.market.filter(item => !item.showAsCard && !commodityTickers.has(item.ticker)) ?? [];
  const sidebarDomestic = data?.domesticFunds.filter(fund => ["NOM006", "ALI006", "NOM008"].includes(fund.code ?? "")) ?? [];
  const sidebarForeign = data?.foreignFunds.slice(0, 2) ?? [];
  const dashboardStatus = data?.lastRefresh?.status === "failed" ? "更新失敗" : data?.lastRefresh?.status === "partial" ? "部分資料更新" : "每日自動更新";
  const refreshFreshness = classifyDataFreshness(data?.lastRefresh?.finishedAt, now, "macro");
  const newsSourceStatuses = (data?.lastRefresh?.newsSourceStatus ?? []) as NewsSourceStatus[];

  return <div className="shell">
    <header className="topbar"><div className="brand"><span className="brand-dot" />投資儀表板<span className="public-label">PUBLIC</span></div><div className="topbar-right"><span id="last-update">{dashboardStatus}：{formatDateTime(data?.lastRefresh?.finishedAt)} · <strong className={`data-freshness ${refreshFreshness.kind}`}>{refreshFreshness.label}</strong></span><span id="globalTime">{now.toLocaleTimeString("zh-TW", { hour12: false })}</span><ThemeToggle /><button className="refresh-btn" onClick={() => refetch()} disabled={isFetching}>{isFetching ? "更新中" : "↻ 更新"}</button></div></header>
    <aside className="sidebar" aria-label="市場摘要">
      <div className="sb-label">原物料</div>{sidebarCommodities.map(item => <button className="sb-item" key={item.ticker} onClick={() => selectTab("asia")}><div><div className="sb-code">{item.ticker}</div><div className="sb-name">{item.name}</div><div className="sb-ts">{item.quoteDate || "--"}</div></div><div><div className={`sb-price ${valueClass(item.percentChange)}`}>{formatNumber(item.price)}</div><div className={`sb-chg ${valueClass(item.percentChange)}`}>{returnText(item.percentChange)}</div></div></button>)}
      <div className="sb-label">台股個股</div>{sidebarStocks.map(item => <button className="sb-item" key={item.ticker} onClick={() => selectTab("asia")}><div><div className="sb-code">{item.ticker}</div><div className="sb-name">{item.name}</div><div className="sb-ts">{item.quoteDate || "--"}</div></div><div><div className={`sb-price ${valueClass(item.percentChange)}`}>{formatNumber(item.price)}</div><div className={`sb-chg ${valueClass(item.percentChange)}`}>{returnText(item.percentChange)}</div></div></button>)}
      <div className="sb-label">國內基金</div>{sidebarDomestic.map(fund => <button className="sb-item" key={fund.id} onClick={() => selectTab("domestic")}><div><div className="sb-code">{fund.code}</div><div className="sb-name">{fund.name.replace("基金", "")}</div><div className="sb-ts">{formatDate(fund.asOfDate)}</div></div><div className="sb-price">{formatNumber(fund.nav)}</div></button>)}
      <div className="sb-label">國際基金</div>{sidebarForeign.map(fund => <button className="sb-item" key={fund.id} onClick={() => selectTab("foreign")}><div><div className="sb-code">境外</div><div className="sb-name">{fund.name.replace("基金", "")}</div><div className="sb-ts">{formatDate(fund.asOfDate)}</div></div><div className="sb-price">{formatNumber(fund.nav, 4)}</div></button>)}
    </aside>
    <main className="main">
      <nav className="tab-nav" aria-label="投資儀表板頁籤">{tabs.map(tab => <button className={`tab ${activeTab === tab.key ? "active" : ""}`} key={tab.key} onClick={() => selectTab(tab.key)}>{tab.label}</button>)}</nav>
      {isLoading ? <div className="loading-state">正在讀取公開資料庫…</div> : null}
      {activeTab === "asia" && <section className="panel active"><MarketCards market={data?.market ?? []} now={now} cardOrder={marketCardOrder} onCardOrderChange={saveMarketCardOrder} /><div className="sec-title">台股個股 / 全球指數</div><div className="table-wrap"><table className="dtable"><thead><tr><th>代碼</th><th className="left">名稱</th><th>現價</th><th>漲跌</th><th>漲跌幅</th><th>更新時間</th><th>狀態</th></tr></thead><tbody>{(data?.market ?? []).map(item => <tr key={item.ticker}><td><span className="t-code">{item.ticker}</span></td><td className="left"><span className="t-name">{item.name}</span></td><td><span className={`t-price ${valueClass(item.percentChange)}`}>{formatNumber(item.price)}</span></td><td><span className={`t-chg ${valueClass(item.percentChange)}`}>{item.change === null ? "--" : `${item.change > 0 ? "+" : ""}${formatNumber(item.change)}`}</span></td><td><span className={`badge badge-${valueClass(item.percentChange)}`}>{returnText(item.percentChange)}</span></td><td className="t-ts"><span className="ts-dot live" />資料截至：{item.quoteDate || "--"} · {item.quoteStatus}</td><td><span className="badge badge-live">{item.quoteStatus}</span></td></tr>)}</tbody></table></div></section>}
      {(activeTab === "domestic" || activeTab === "foreign") && <section className="panel active"><FundBrowsePanel funds={filteredFunds} favoriteFunds={favoriteFunds} now={now} query={fundQuery} scope={fundScope} currency={fundCurrency} sortKey={fundSortKey} currencies={availableCurrencies} importMessage={favoriteImportMessage} onQueryChange={setFundQuery} onScopeChange={setFundScope} onCurrencyChange={setFundCurrency} onSortChange={setFundSortKey} onToggleFavorite={id => saveFavoriteFundIds(toggleFavoriteFundId(favoriteFundIds, id))} onClearFavorites={() => saveFavoriteFundIds([])} onExportFavorites={exportFavorites} onImportFavorites={importFavorites} /></section>}
      {activeTab === "performance" && <section className="panel active"><MarketCards market={data?.market ?? []} now={now} cardOrder={marketCardOrder} onCardOrderChange={saveMarketCardOrder} /><div className="sec-title">一週、一月、三月、YTD 與一年漲跌幅排行</div><div className="table-wrap"><table className="dtable"><thead><tr><th>代碼</th><th className="left">名稱</th><th>淨值</th><th>日期</th><th>一週</th><th>近 1 月</th><th>近 3 月</th><th>YTD</th><th>一年</th><th>年度排名</th></tr></thead><tbody>{weeklyRanking.map(fund => <tr key={fund.id}><td><span className="t-code">{fund.code || "境外"}</span></td><td className="left"><span className="t-name">{fund.name}</span></td><td><span className="t-price">{fund.currency === "TWD" ? "" : `${fund.currency} `}{formatNumber(fund.nav, fund.currency === "TWD" ? 2 : 4)}</span></td><td className="t-ts">{formatDate(fund.asOfDate)}</td><td><span className={`badge badge-${valueClass(fund.perf.week)}`}>{returnText(fund.perf.week)}</span></td><td><span className={`badge badge-${valueClass(fund.perf.month)}`}>{returnText(fund.perf.month)}</span></td><td><span className={`badge badge-${valueClass(fund.perf.quarter)}`}>{returnText(fund.perf.quarter)}</span></td><td><span className={`badge badge-${valueClass(fund.perf.ytd)}`}>{returnText(fund.perf.ytd)}</span></td><td><span className={`badge badge-${valueClass(fund.perf.year)}`}>{returnText(fund.perf.year)}</span></td><td className="t-ts">{fund.annualRank ? `${fund.annualRank} / ${fund.annualTotal}` : "--"}</td></tr>)}</tbody></table></div></section>}
      {activeTab === "news" && <section className="panel active"><div className="sec-title">財經即時新聞 <small>多來源標題與公開摘要</small></div><NewsSourceHealth statuses={newsSourceStatuses} refreshedAt={data?.lastRefresh?.finishedAt} /><NewsSourceHealthTrend history={newsHealthHistory as NewsHealthHistoryPoint[]} /><p className="news-disclosure">整合華爾街日報、CNBC、MarketWatch、Financial Times 與 Google 新聞 RSS；付費或需登入的內容僅提供合法取得的標題、摘要、時間與原文連結。</p><div className="news-filter-bar" aria-label="財經新聞關鍵字、來源與分類篩選"><label className="news-keyword-field">關鍵字<input value={newsKeyword} onChange={event => setNewsKeyword(event.target.value)} placeholder="搜尋標題、摘要或來源" aria-label="搜尋財經新聞關鍵字" /></label><label>來源<select value={newsSource} onChange={event => setNewsSource(event.target.value)} aria-label="篩選財經新聞來源"><option value="all">全部來源</option>{newsSources.map(source => <option value={source} key={source}>{source}</option>)}</select></label><div className="news-category-chips" aria-label="新聞分類" role="group">{["all", "市場", "總經", "基金／債券", "台灣"].map(category => <button type="button" className={`filter-chip ${newsCategoryFilter === category ? "active" : ""}`} key={category} onClick={() => setNewsCategoryFilter(category)}>{category === "all" ? "全部分類" : category}</button>)}</div><div className="news-preference-chips" aria-label="新聞管理狀態" role="group">{[["all", "全部新聞"], ["favorites", "收藏"], ["readLater", "稍後閱讀"]].map(([mode, label]) => <button type="button" className={`filter-chip ${newsPreferenceMode === mode ? "active" : ""}`} key={mode} onClick={() => setNewsPreferenceMode(mode as "all" | "favorites" | "readLater")}>{label}</button>)}</div><span>目前 {filteredNews.length} 則</span></div>{newsHighlights.length > 0 ? <section className="news-highlights" aria-label="快速掌握新聞重點"><div className="detail-section-title"><span>快速掌握</span><small>優先顯示最新三則</small></div>{newsHighlights.map(item => <a className="news-highlight" href={item.url} target="_blank" rel="noreferrer" key={`highlight-${item.id}`}><strong>{item.title}</strong><span>{item.source} · {formatDateTime(item.publishedAt)}</span></a>)}</section> : null}<div className="news-list">{filteredNews.length === 0 ? <div className="empty-inline">等待每日 RSS 更新或請調整來源、分類或管理狀態。</div> : filteredNews.map(item => { const preferenceId = newsPreferenceId(item); const isFavorite = newsPreferences.favorites.includes(preferenceId); const isReadLater = newsPreferences.readLater.includes(preferenceId); return <article className="news-item" key={item.id}><a className="news-title" href={item.url} target="_blank" rel="noreferrer">{item.title}</a>{item.summary ? <p className="news-body">{item.summary}</p> : null}<div className="news-meta"><span>{formatDateTime(item.publishedAt)}</span><span>{item.source}</span></div><div className="news-item-actions"><button className="news-action-button" type="button" onClick={() => requestNewsSummary(item)}> {newsSummaryLoadingId === String(item.id) ? "摘要生成中…" : "AI 摘要"}</button><button className="news-action-button" type="button" onClick={() => toggleNewsFavorite(preferenceId)} aria-pressed={isFavorite}>{isFavorite ? "已收藏" : "收藏"}</button><button className="news-action-button" type="button" onClick={() => toggleNewsReadLater(preferenceId)} aria-pressed={isReadLater}>{isReadLater ? "已加入稍後閱讀" : "稍後閱讀"}</button></div>{newsSummaryById[String(item.id)] ? <div className="news-ai-summary"><strong>AI 核心摘要</strong><p>{newsSummaryById[String(item.id)]}</p><div className="news-summary-actions"><button className="news-action-button" type="button" onClick={() => requestNewsSummary(item)} disabled={newsSummaryLoadingId === String(item.id)}>{newsSummaryLoadingId === String(item.id) ? "重新生成中…" : "重新生成"}</button><button className="news-action-button" type="button" onClick={() => void copyNewsSummary(String(item.id))}>{newsSummaryCopiedId === String(item.id) ? "已複製" : "一鍵複製"}</button></div>{newsSummaryCopyErrorById[String(item.id)] ? <small className="news-copy-error">{newsSummaryCopyErrorById[String(item.id)]}</small> : null}</div> : null}{newsSummaryErrorById[String(item.id)] ? <div className="news-ai-summary error">{newsSummaryErrorById[String(item.id)]}</div> : null}</article>; })}</div></section>}
      {activeTab === "observatory" && <ObservatoryPanel data={data?.observatory} news={data?.news ?? []} favoriteNews={(data?.news ?? []).filter(item => newsPreferences.favorites.includes(newsPreferenceId(item)))} onOpenAlertHistory={() => selectTab("alertHistory")} />}
      {activeTab === "alertHistory" && <ObservatoryAlertHistory onBack={() => selectTab("observatory")} />}
      {activeTab === "newsLibrary" && <NewsLibraryPanel news={data?.news ?? []} preferences={newsPreferences} onChange={setNewsPreferences} onBack={() => selectTab("news")} />}
    </main>
  </div>;
}
