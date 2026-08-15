import { trpc } from "@/lib/trpc";
import { useLocation, useRoute } from "wouter";

const periodLabels = [
  ["week", "一週"],
  ["month", "一月"],
  ["quarter", "三月"],
  ["halfYear", "半年"],
  ["year", "一年"],
] as const;

function formatNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "--";
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "--";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "--" : new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(parsed);
}

function valueClass(value: number | null | undefined) {
  if (value === null || value === undefined) return "flat";
  return value > 0 ? "up" : value < 0 ? "down" : "flat";
}

function returnText(value: number | null | undefined) {
  if (value === null || value === undefined) return "--";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function FullHistoryChart({ history }: { history: Array<{ date: string; nav: number }> }) {
  if (history.length < 2) return <div className="detail-empty">歷史淨值資料不足。</div>;
  const values = history.map(point => point.nav);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  const points = history.map((point, index) => `${((index / (history.length - 1)) * 100).toFixed(3)},${(92 - ((point.nav - minimum) / range) * 78).toFixed(3)}`).join(" ");
  const start = history[0]?.date;
  const end = history.at(-1)?.date;
  return <div className="detail-chart-wrap"><div className="detail-chart-meta"><span>{formatDate(start)}</span><span>最高 {formatNumber(maximum, 4)} · 最低 {formatNumber(minimum, 4)}</span><span>{formatDate(end)}</span></div><svg className="detail-chart" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="完整歷史淨值走勢"><line x1="0" x2="100" y1="50" y2="50" className="sparkline-guide" /><polygon points={`0,100 ${points} 100,100`} className="detail-chart-area" /><polyline points={points} className="detail-chart-line" vectorEffect="non-scaling-stroke" /></svg></div>;
}

export default function FundDetail() {
  const [, params] = useRoute("/fund/:id");
  const [, setLocation] = useLocation();
  const fundId = Number(params?.id);
  const { data: fund, isLoading, error } = trpc.fund.detail.useQuery({ id: fundId }, { enabled: Number.isInteger(fundId) && fundId > 0 });

  if (isLoading) return <main className="detail-page"><div className="loading-state">正在讀取基金完整資料…</div></main>;
  if (error || !fund) return <main className="detail-page"><button className="back-link" onClick={() => setLocation("/")}>← 返回投資儀表板</button><div className="detail-empty">找不到此基金或目前沒有可公開的詳細資料。</div></main>;

  const navDigits = fund.currency === "TWD" ? 2 : 4;
  return <main className="detail-page">
    <div className="detail-topline"><button className="back-link" onClick={() => setLocation(`/?tab=${fund.fundType}`)}>← 返回基金清單</button><span>公開基金資料</span></div>
    <header className="detail-hero"><div><div className="detail-code">{fund.code ?? `境外 · ${fund.currency}`}</div><h1>{fund.name}</h1><p>{fund.fundType === "domestic" ? "國內基金" : "國際基金"} · 計價幣別 {fund.currency}</p></div><div className="detail-latest"><span>最新淨值</span><strong>{fund.currency === "TWD" ? "" : `${fund.currency} `}{formatNumber(fund.nav, navDigits)}</strong><small>淨值日期：{formatDate(fund.asOfDate)}</small></div></header>

    <section className="detail-section"><div className="detail-section-title"><span>完整歷史淨值</span><small>共 {fund.history.length} 筆</small></div><FullHistoryChart history={fund.history} /></section>

    <section className="detail-section"><div className="detail-section-title"><span>區間比較</span><small>以距最新淨值日最近、且不晚於區間起點的可用淨值計算</small></div><div className="detail-performance-grid">{periodLabels.map(([key, label]) => <article className="detail-performance" key={key}><span>{label}</span><strong className={valueClass(fund.perf[key])}>{returnText(fund.perf[key])}</strong></article>)}</div></section>

    <section className="detail-section"><div className="detail-section-title"><span>資料來源</span><small>每日自動更新</small></div><div className="source-card"><div><strong>{fund.source.name}</strong><p>{fund.source.detail}</p><p>最近同步：{formatDate(fund.source.lastSyncedAt)}</p></div><a href={fund.source.url} target="_blank" rel="noreferrer">開啟資料來源 ↗</a></div></section>

    <section className="detail-section"><div className="detail-section-title"><span>完整歷史淨值明細</span><small>依日期由新至舊</small></div><div className="detail-history-table-wrap"><table className="detail-history-table"><thead><tr><th>日期</th><th>淨值</th></tr></thead><tbody>{[...fund.history].reverse().map(point => <tr key={point.date}><td>{formatDate(point.date)}</td><td>{fund.currency === "TWD" ? "" : `${fund.currency} `}{formatNumber(point.nav, navDigits)}</td></tr>)}</tbody></table></div></section>
  </main>;
}
