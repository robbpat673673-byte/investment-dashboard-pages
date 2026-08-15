import { trpc } from "@/lib/trpc";
import { buildMultiComparisonSeries, sliceHistoryByMonths, type NavHistoryPoint } from "@/lib/fundComparison";
import { FAVORITE_FUNDS_STORAGE_KEY, parseFavoriteFundIds, toggleFavoriteFundId } from "@/lib/fundPreferences";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";

const periodLabels = [["week", "一週"], ["month", "一月"], ["quarter", "三月"], ["halfYear", "半年"], ["year", "一年"], ["ytd", "YTD"]] as const;
const chartWindowOptions = [{ value: 1, label: "近一月" }, { value: 6, label: "近半年" }, { value: 12, label: "近一年" }] as const;
type ChartMode = "nav" | "totalReturn";

function formatNumber(value: number | null | undefined, digits = 2) { if (value === null || value === undefined || !Number.isFinite(value)) return "--"; return new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value); }
function formatDate(value: Date | string | null | undefined) { if (!value) return "--"; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? "--" : new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(parsed); }
function valueClass(value: number | null | undefined) { return value === null || value === undefined ? "flat" : value > 0 ? "up" : value < 0 ? "down" : "flat"; }
function returnText(value: number | null | undefined) { return value === null || value === undefined ? "--" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`; }

function FullHistoryChart({ history }: { history: NavHistoryPoint[] }) {
  if (history.length < 2) return <div className="detail-empty">歷史淨值資料不足。</div>;
  const values = history.map(point => point.nav); const minimum = Math.min(...values); const maximum = Math.max(...values); const range = maximum - minimum || 1;
  const points = history.map((point, index) => `${((index / (history.length - 1)) * 100).toFixed(3)},${(92 - ((point.nav - minimum) / range) * 78).toFixed(3)}`).join(" ");
  return <div className="detail-chart-wrap"><div className="detail-chart-meta"><span>{formatDate(history[0]?.date)}</span><span>最高 {formatNumber(maximum, 4)} · 最低 {formatNumber(minimum, 4)}</span><span>{formatDate(history.at(-1)?.date)}</span></div><svg className="detail-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="完整歷史淨值走勢"><line x1="0" x2="100" y1="50" y2="50" className="sparkline-guide" /><polygon points={`0,100 ${points} 100,100`} className="detail-chart-area" /><polyline points={points} className="detail-chart-line" vectorEffect="non-scaling-stroke" /></svg></div>;
}

function MultiComparisonChart({ lines }: { lines: Array<{ key: string; label: string; history: NavHistoryPoint[] }> }) {
  const series = useMemo(() => buildMultiComparisonSeries(lines), [lines]);
  if (!series) return <div className="detail-empty">請選擇比較基金或勾選 S&P 500 基準，並確認共同期間資料充足。</div>;
  const range = series.max - series.min || 1;
  const colors = ["comparison-primary-line", "comparison-secondary-line", "comparison-benchmark-line"];
  const points = (items: typeof series.lines[number]["points"]) => items.map(point => `${point.x.toFixed(3)},${(92 - ((point.value - series.min) / range) * 78).toFixed(3)}`).join(" ");
  return <div className="comparison-chart-wrap"><div className="comparison-legend">{series.lines.map((line, index) => <span className={`comparison-line-label line-${index}`} key={line.key}><i />{line.label}</span>)}<small>{formatDate(series.startDate)} — {formatDate(series.endDate)}；共同期間首日 = 100</small></div><svg className="comparison-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="基金與基準相對走勢比較"><line x1="0" x2="100" y1="50" y2="50" className="sparkline-guide" />{series.lines.map((line, index) => <polyline key={line.key} points={points(line.points)} className={colors[index] ?? "comparison-benchmark-line"} vectorEffect="non-scaling-stroke" />)}</svg></div>;
}

export default function FundDetail() {
  const [, params] = useRoute("/fund/:id"); const [, setLocation] = useLocation(); const fundId = Number(params?.id);
  const [compareFundId, setCompareFundId] = useState<number | null>(null);
  const [chartMonths, setChartMonths] = useState<1 | 6 | 12>(12);
  const [chartMode, setChartMode] = useState<ChartMode>("nav");
  const [showBenchmark, setShowBenchmark] = useState(false);
  const [holdingUnits, setHoldingUnits] = useState(0);
  const [favoriteFundIds, setFavoriteFundIds] = useState<number[]>(() => typeof window === "undefined" ? [] : parseFavoriteFundIds(window.localStorage.getItem(FAVORITE_FUNDS_STORAGE_KEY)));
  const { data: fund, isLoading, error } = trpc.fund.detail.useQuery({ id: fundId }, { enabled: Number.isInteger(fundId) && fundId > 0 });
  const compareInput = useMemo(() => ({ id: compareFundId ?? 1 }), [compareFundId]);
  const { data: comparisonFund, isLoading: isComparisonLoading } = trpc.fund.detail.useQuery(compareInput, { enabled: compareFundId !== null });
  const { data: dashboard } = trpc.dashboard.get.useQuery();
  const primaryChartHistory = useMemo(() => {
    const history = chartMode === "totalReturn" && fund?.totalReturn.available ? fund.totalReturn.history : fund?.history ?? [];
    return sliceHistoryByMonths(history, chartMonths);
  }, [fund, chartMode, chartMonths]);
  const secondaryChartHistory = useMemo(() => {
    const history = chartMode === "totalReturn" && comparisonFund?.totalReturn.available ? comparisonFund.totalReturn.history : comparisonFund?.history ?? [];
    return sliceHistoryByMonths(history, chartMonths);
  }, [comparisonFund, chartMode, chartMonths]);
  const benchmarkChartHistory = useMemo(() => sliceHistoryByMonths(fund?.benchmark.history ?? [], chartMonths), [fund, chartMonths]);
  const comparisonLines = useMemo(() => {
    const lines: Array<{ key: string; label: string; history: NavHistoryPoint[] }> = fund ? [{ key: "primary", label: chartMode === "totalReturn" && !fund.totalReturn.available ? `${fund.code ?? fund.name}（純淨值）` : fund.code ?? fund.name, history: primaryChartHistory }] : [];
    if (comparisonFund) lines.push({ key: "secondary", label: chartMode === "totalReturn" && !comparisonFund.totalReturn.available ? `${comparisonFund.code ?? comparisonFund.name}（純淨值）` : comparisonFund.code ?? comparisonFund.name, history: secondaryChartHistory });
    if (showBenchmark) lines.push({ key: "benchmark", label: "S&P 500（價格指數）", history: benchmarkChartHistory });
    return lines;
  }, [fund, comparisonFund, chartMode, primaryChartHistory, secondaryChartHistory, benchmarkChartHistory, showBenchmark]);
  if (isLoading) return <main className="detail-page"><div className="loading-state">正在讀取基金完整資料…</div></main>;
  if (error || !fund) return <main className="detail-page"><button className="back-link" onClick={() => setLocation("/")}>← 返回投資儀表板</button><div className="detail-empty">找不到此基金或目前沒有可公開的詳細資料。</div></main>;
  const navDigits = fund.currency === "TWD" ? 2 : 4;
  const comparisonOptions = [...(dashboard?.domesticFunds ?? []), ...(dashboard?.foreignFunds ?? [])].filter(item => item.id !== fund.id);
  const isFavorite = favoriteFundIds.includes(fund.id);
  const latestDistribution = fund.distributions.at(-1);
  const projectedCashflow = latestDistribution?.annualizedYield && fund.nav && holdingUnits > 0 ? holdingUnits * fund.nav * (latestDistribution.annualizedYield / 100) : null;
  const saveFavorites = (nextIds: number[]) => { setFavoriteFundIds(nextIds); if (nextIds.length === 0) window.localStorage.removeItem(FAVORITE_FUNDS_STORAGE_KEY); else window.localStorage.setItem(FAVORITE_FUNDS_STORAGE_KEY, JSON.stringify(nextIds)); };
  return <main className="detail-page">
    <div className="detail-topline"><button className="back-link" onClick={() => setLocation(`/?tab=${fund.fundType}`)}>← 返回基金清單</button><div className="detail-topline-actions"><span>公開基金資料</span><ThemeToggle /></div></div>
    <header className="detail-hero"><div><div className="detail-code">{fund.code ?? `境外 · ${fund.currency}`}</div><h1>{fund.name}</h1><p>{fund.fundType === "domestic" ? "國內基金" : "國際基金"} · 計價幣別 {fund.currency}</p>{fund.isin || fund.bankCode ? <div className="fund-identifier-row">{fund.isin ? <span>ISIN：{fund.isin}</span> : null}{fund.bankCode ? <span>銀行／通路代號：{fund.bankCode}</span> : null}</div> : null}</div><div className="detail-latest"><span>最新淨值</span><strong>{fund.currency === "TWD" ? "" : `${fund.currency} `}{formatNumber(fund.nav, navDigits)}</strong><small>淨值日期：{formatDate(fund.asOfDate)}</small><button type="button" className={`detail-favorite-toggle ${isFavorite ? "active" : ""}`} onClick={() => saveFavorites(toggleFavoriteFundId(favoriteFundIds, fund.id))}>{isFavorite ? "★ 已加入自選" : "☆ 加入自選"}</button></div></header>
    <section className="detail-section"><div className="detail-section-title"><span>完整歷史淨值</span><small>共 {fund.history.length} 筆原始淨值</small></div><FullHistoryChart history={fund.history} /></section>
    <section className="detail-section"><div className="detail-section-title"><span>區間比較</span><small>以純淨值計算</small></div><div className="detail-performance-grid">{periodLabels.map(([key, label]) => <article className="detail-performance" key={key}><span>{label}</span><strong className={valueClass(fund.perf[key])}>{returnText(fund.perf[key])}</strong></article>)}</div></section>
    <section className="detail-section"><div className="detail-section-title"><span>比較圖表</span><small>{chartMode === "totalReturn" ? "含息模式以配息於除息日淨值再投入重建；資料不足時標示為純淨值。" : "純淨值模式使用每日公布淨值。"}</small></div><div className="comparison-toolbar"><div className="comparison-button-group" aria-label="比較期間">{chartWindowOptions.map(option => <button type="button" className={chartMonths === option.value ? "active" : ""} key={option.value} onClick={() => setChartMonths(option.value)}>{option.label}</button>)}</div><div className="comparison-button-group" aria-label="報酬口徑"><button type="button" className={chartMode === "nav" ? "active" : ""} onClick={() => setChartMode("nav")}>純淨值</button><button type="button" className={chartMode === "totalReturn" ? "active" : ""} onClick={() => setChartMode("totalReturn")}>含息總報酬</button></div><label className="benchmark-toggle"><input type="checkbox" checked={showBenchmark} onChange={event => setShowBenchmark(event.target.checked)} />疊加 S&P 500</label></div><div className="comparison-select-row"><label>選擇另一檔基金<select value={compareFundId ?? ""} onChange={event => setCompareFundId(event.target.value ? Number(event.target.value) : null)}><option value="">尚未選擇</option>{comparisonOptions.map(item => <option value={item.id} key={item.id}>{item.code ?? "境外"} · {item.name}</option>)}</select></label></div>{isComparisonLoading ? <div className="detail-empty">正在讀取比較基金資料…</div> : <MultiComparisonChart lines={comparisonLines} />}{comparisonFund ? <><div className="comparison-performance-grid">{periodLabels.map(([key, label]) => <article key={key}><span>{label}</span><strong className={valueClass(fund.perf[key])}>{returnText(fund.perf[key])}</strong><strong className={valueClass(comparisonFund.perf[key])}>{returnText(comparisonFund.perf[key])}</strong></article>)}</div><div className="comparison-name-row"><span>{fund.name}</span><span>{comparisonFund.name}</span></div></> : null}<p className="comparison-disclosure">基準採 Yahoo Finance 的 S&P 500 價格指數，並非含息指數；不同幣別與費用結構的基金比較僅供觀察。</p></section>
    <section className="detail-section"><div className="detail-section-title"><span>配息追蹤與現金流試算</span><small>依最新公開配息資料估算，非未來配息承諾</small></div>{latestDistribution ? <div className="distribution-grid"><article><span>年化配息率</span><strong>{latestDistribution.annualizedYield === null ? "--" : `${formatNumber(latestDistribution.annualizedYield)}%`}</strong></article><article><span>最近除息日</span><strong>{formatDate(latestDistribution.exDate)}</strong></article><article><span>最近每單位配息</span><strong>{fund.currency} {formatNumber(latestDistribution.amount, 4)}</strong></article><label className="cashflow-input"><span>持有單位</span><input type="number" min="0" step="1" value={holdingUnits || ""} onChange={event => setHoldingUnits(Math.max(0, Number(event.target.value)))} placeholder="輸入單位數" /></label><article className="cashflow-result"><span>預估年度現金流</span><strong>{projectedCashflow === null ? "輸入持有單位" : `${fund.currency} ${formatNumber(projectedCashflow, 2)}`}</strong></article></div> : <div className="detail-empty">目前公開來源未提供此基金的可用配息歷史；不以零值或假設資料替代。</div>}<p className="comparison-disclosure">估算公式：持有單位 × 最新淨值 × 最新年化配息率。配息可能來自本金，且過去配息率不代表未來配息。</p></section>
    <section className="detail-section"><div className="detail-section-title"><span>資料來源</span><small>每日自動更新</small></div><div className="source-card"><div><strong>{fund.source.name}</strong><p>{fund.source.detail}</p><p>最近同步：{formatDate(fund.source.lastSyncedAt)}</p>{latestDistribution ? <p>配息資料：<a href={latestDistribution.sourceUrl} target="_blank" rel="noreferrer">MoneyDJ 基金配息頁 ↗</a></p> : null}</div><a href={fund.source.url} target="_blank" rel="noreferrer">開啟淨值來源 ↗</a></div></section>
    <section className="detail-section"><div className="detail-section-title"><span>完整歷史淨值明細</span><small>依日期由新至舊</small></div><div className="detail-history-table-wrap"><table className="detail-history-table"><thead><tr><th>日期</th><th>淨值</th></tr></thead><tbody>{[...fund.history].reverse().map(point => <tr key={point.date}><td>{formatDate(point.date)}</td><td>{fund.currency === "TWD" ? "" : `${fund.currency} `}{formatNumber(point.nav, navDigits)}</td></tr>)}</tbody></table></div></section>
  </main>;
}
