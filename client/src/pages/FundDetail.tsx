import { trpc } from "@/lib/trpc";
import { buildFundComparisonSeries, type NavHistoryPoint } from "@/lib/fundComparison";
import { FAVORITE_FUNDS_STORAGE_KEY, parseFavoriteFundIds, toggleFavoriteFundId } from "@/lib/fundPreferences";
import { useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";

const periodLabels = [["week", "一週"], ["month", "一月"], ["quarter", "三月"], ["halfYear", "半年"], ["year", "一年"]] as const;

function formatNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}
function formatDate(value: Date | string | null | undefined) {
  if (!value) return "--";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "--" : new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(parsed);
}
function valueClass(value: number | null | undefined) { return value === null || value === undefined ? "flat" : value > 0 ? "up" : value < 0 ? "down" : "flat"; }
function returnText(value: number | null | undefined) { return value === null || value === undefined ? "--" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`; }

function FullHistoryChart({ history }: { history: NavHistoryPoint[] }) {
  if (history.length < 2) return <div className="detail-empty">歷史淨值資料不足。</div>;
  const values = history.map(point => point.nav); const minimum = Math.min(...values); const maximum = Math.max(...values); const range = maximum - minimum || 1;
  const points = history.map((point, index) => `${((index / (history.length - 1)) * 100).toFixed(3)},${(92 - ((point.nav - minimum) / range) * 78).toFixed(3)}`).join(" ");
  return <div className="detail-chart-wrap"><div className="detail-chart-meta"><span>{formatDate(history[0]?.date)}</span><span>最高 {formatNumber(maximum, 4)} · 最低 {formatNumber(minimum, 4)}</span><span>{formatDate(history.at(-1)?.date)}</span></div><svg className="detail-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="完整歷史淨值走勢"><line x1="0" x2="100" y1="50" y2="50" className="sparkline-guide" /><polygon points={`0,100 ${points} 100,100`} className="detail-chart-area" /><polyline points={points} className="detail-chart-line" vectorEffect="non-scaling-stroke" /></svg></div>;
}

function ComparisonChart({ primaryHistory, secondaryHistory, primaryName, secondaryName }: { primaryHistory: NavHistoryPoint[]; secondaryHistory: NavHistoryPoint[]; primaryName: string; secondaryName: string }) {
  const series = useMemo(() => buildFundComparisonSeries(primaryHistory, secondaryHistory), [primaryHistory, secondaryHistory]);
  if (!series) return <div className="detail-empty">兩檔基金的共同可比較歷史資料不足。</div>;
  const range = series.max - series.min || 1;
  const points = (items: typeof series.primary) => items.map(point => `${point.x.toFixed(3)},${(92 - ((point.value - series.min) / range) * 78).toFixed(3)}`).join(" ");
  return <div className="comparison-chart-wrap"><div className="comparison-legend"><span className="primary"><i />{primaryName}</span><span className="secondary"><i />{secondaryName}</span><small>{formatDate(series.startDate)} — {formatDate(series.endDate)}；共同期間首日 = 100</small></div><svg className="comparison-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="雙基金相對走勢比較"><line x1="0" x2="100" y1="50" y2="50" className="sparkline-guide" /><polyline points={points(series.primary)} className="comparison-primary-line" vectorEffect="non-scaling-stroke" /><polyline points={points(series.secondary)} className="comparison-secondary-line" vectorEffect="non-scaling-stroke" /></svg></div>;
}

export default function FundDetail() {
  const [, params] = useRoute("/fund/:id"); const [, setLocation] = useLocation(); const fundId = Number(params?.id);
  const [compareFundId, setCompareFundId] = useState<number | null>(null);
  const [favoriteFundIds, setFavoriteFundIds] = useState<number[]>(() => typeof window === "undefined" ? [] : parseFavoriteFundIds(window.localStorage.getItem(FAVORITE_FUNDS_STORAGE_KEY)));
  const { data: fund, isLoading, error } = trpc.fund.detail.useQuery({ id: fundId }, { enabled: Number.isInteger(fundId) && fundId > 0 });
  const compareInput = useMemo(() => ({ id: compareFundId ?? 1 }), [compareFundId]);
  const { data: comparisonFund, isLoading: isComparisonLoading } = trpc.fund.detail.useQuery(compareInput, { enabled: compareFundId !== null });
  const { data: dashboard } = trpc.dashboard.get.useQuery();
  if (isLoading) return <main className="detail-page"><div className="loading-state">正在讀取基金完整資料…</div></main>;
  if (error || !fund) return <main className="detail-page"><button className="back-link" onClick={() => setLocation("/")}>← 返回投資儀表板</button><div className="detail-empty">找不到此基金或目前沒有可公開的詳細資料。</div></main>;
  const navDigits = fund.currency === "TWD" ? 2 : 4;
  const comparisonOptions = [...(dashboard?.domesticFunds ?? []), ...(dashboard?.foreignFunds ?? [])].filter(item => item.id !== fund.id);
  const selectedComparisonFund = compareFundId === null ? undefined : comparisonFund;
  const isFavorite = favoriteFundIds.includes(fund.id);
  const saveFavorites = (nextIds: number[]) => { setFavoriteFundIds(nextIds); if (nextIds.length === 0) window.localStorage.removeItem(FAVORITE_FUNDS_STORAGE_KEY); else window.localStorage.setItem(FAVORITE_FUNDS_STORAGE_KEY, JSON.stringify(nextIds)); };
  return <main className="detail-page">
    <div className="detail-topline"><button className="back-link" onClick={() => setLocation(`/?tab=${fund.fundType}`)}>← 返回基金清單</button><span>公開基金資料</span></div>
    <header className="detail-hero"><div><div className="detail-code">{fund.code ?? `境外 · ${fund.currency}`}</div><h1>{fund.name}</h1><p>{fund.fundType === "domestic" ? "國內基金" : "國際基金"} · 計價幣別 {fund.currency}</p></div><div className="detail-latest"><span>最新淨值</span><strong>{fund.currency === "TWD" ? "" : `${fund.currency} `}{formatNumber(fund.nav, navDigits)}</strong><small>淨值日期：{formatDate(fund.asOfDate)}</small><button type="button" className={`detail-favorite-toggle ${isFavorite ? "active" : ""}`} onClick={() => saveFavorites(toggleFavoriteFundId(favoriteFundIds, fund.id))}>{isFavorite ? "★ 已加入自選" : "☆ 加入自選"}</button></div></header>
    <section className="detail-section"><div className="detail-section-title"><span>完整歷史淨值</span><small>共 {fund.history.length} 筆</small></div><FullHistoryChart history={fund.history} /></section>
    <section className="detail-section"><div className="detail-section-title"><span>區間比較</span><small>以距最新淨值日最近、且不晚於區間起點的可用淨值計算</small></div><div className="detail-performance-grid">{periodLabels.map(([key, label]) => <article className="detail-performance" key={key}><span>{label}</span><strong className={valueClass(fund.perf[key])}>{returnText(fund.perf[key])}</strong></article>)}</div></section>
    <section className="detail-section"><div className="detail-section-title"><span>雙基金比較</span><small>兩檔基金共同可用期間的首日均正規化為 100</small></div><div className="comparison-select-row"><label>選擇另一檔基金<select value={compareFundId ?? ""} onChange={event => setCompareFundId(event.target.value ? Number(event.target.value) : null)}><option value="">尚未選擇</option>{comparisonOptions.map(item => <option value={item.id} key={item.id}>{item.code ?? "境外"} · {item.name}</option>)}</select></label>{selectedComparisonFund ? <span>比較：{selectedComparisonFund.code ?? "境外"} · {selectedComparisonFund.currency}</span> : null}</div>{isComparisonLoading ? <div className="detail-empty">正在讀取比較基金資料…</div> : selectedComparisonFund ? <><ComparisonChart primaryHistory={fund.history} secondaryHistory={selectedComparisonFund.history} primaryName={fund.code ?? fund.name} secondaryName={selectedComparisonFund.code ?? selectedComparisonFund.name} /><div className="comparison-performance-grid">{periodLabels.map(([key, label]) => <article key={key}><span>{label}</span><strong className={valueClass(fund.perf[key])}>{returnText(fund.perf[key])}</strong><strong className={valueClass(selectedComparisonFund.perf[key])}>{returnText(selectedComparisonFund.perf[key])}</strong></article>)}</div><div className="comparison-name-row"><span>{fund.name}</span><span>{selectedComparisonFund.name}</span></div></> : <div className="detail-empty">選擇另一檔基金後，即可比較完整歷史相對走勢與五期報酬。</div>}</section>
    <section className="detail-section"><div className="detail-section-title"><span>資料來源</span><small>每日自動更新</small></div><div className="source-card"><div><strong>{fund.source.name}</strong><p>{fund.source.detail}</p><p>最近同步：{formatDate(fund.source.lastSyncedAt)}</p></div><a href={fund.source.url} target="_blank" rel="noreferrer">開啟資料來源 ↗</a></div></section>
    <section className="detail-section"><div className="detail-section-title"><span>完整歷史淨值明細</span><small>依日期由新至舊</small></div><div className="detail-history-table-wrap"><table className="detail-history-table"><thead><tr><th>日期</th><th>淨值</th></tr></thead><tbody>{[...fund.history].reverse().map(point => <tr key={point.date}><td>{formatDate(point.date)}</td><td>{fund.currency === "TWD" ? "" : `${fund.currency} `}{formatNumber(point.nav, navDigits)}</td></tr>)}</tbody></table></div></section>
  </main>;
}
