import { trpc } from "@/lib/trpc";
import { moveMarketCard, orderMarketCards } from "@/lib/marketCardOrder";
import { useEffect, useMemo, useState } from "react";

type TabKey = "asia" | "domestic" | "foreign" | "performance" | "news";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "asia", label: "全球市場" },
  { key: "domestic", label: "國內基金" },
  { key: "foreign", label: "國際基金" },
  { key: "performance", label: "漲跌幅" },
  { key: "news", label: "財經即時新聞" },
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
  name: string;
  code: string | null;
  currency: string;
  nav: number | null;
  asOfDate: Date | string | null;
  history: Array<{ date: string; nav: number }>;
  annualRank: number | null;
  annualTotal: number;
  perf: Record<(typeof periodLabels)[number][0], number | null>;
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

function FundCard({ fund }: { fund: FundCardData }) {
  const annualReturn = fund.perf.year;
  const rankWidth = fund.annualRank && fund.annualTotal > 1 ? Math.max(8, ((fund.annualTotal - fund.annualRank) / (fund.annualTotal - 1)) * 100) : 50;
  return (
    <article className="fund-card">
      <div className="fc-code">{fund.code || `境外 · ${fund.currency}`}</div>
      <div className="fc-name">{fund.name}</div>
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
    </article>
  );
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
            <span className="idx-drag-handle" aria-hidden="true">⋮⋮</span>
            <div className="idx-name">{item.name}</div>
            <div className={`idx-val ${valueClass(item.percentChange)}`}>{formatNumber(item.price)}</div>
            <div className={`idx-chg ${valueClass(item.percentChange)}`}>
              {item.change === null ? "--" : `${item.change > 0 ? "+" : ""}${formatNumber(item.change)}`} ({returnText(item.percentChange)})
            </div>
            <div className="idx-ts">{item.quoteDate || "--"}</div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTabFromUrl);
  const [now, setNow] = useState(() => new Date());
  const [marketCardOrder, setMarketCardOrder] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(window.localStorage.getItem("investment-dashboard-market-order") ?? "[]") as string[]; } catch { return []; }
  });
  const { data, isLoading, isFetching, refetch } = trpc.dashboard.get.useQuery(undefined, { refetchInterval: 60_000 });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const saveMarketCardOrder = (nextOrder: string[]) => {
    setMarketCardOrder(nextOrder);
    if (nextOrder.length === 0) window.localStorage.removeItem("investment-dashboard-market-order");
    else window.localStorage.setItem("investment-dashboard-market-order", JSON.stringify(nextOrder));
  };

  const weeklyRanking = useMemo(() => {
    const allFunds = [...(data?.domesticFunds ?? []), ...(data?.foreignFunds ?? [])];
    return allFunds.sort((left, right) => (right.perf.week ?? -Infinity) - (left.perf.week ?? -Infinity));
  }, [data]);

  const sidebarMarket = data?.market.filter(item => item.showAsCard).slice(0, 4) ?? [];
  const sidebarStocks = data?.market.filter(item => !item.showAsCard) ?? [];
  const sidebarDomestic = data?.domesticFunds.filter(fund => ["NOM006", "ALI006", "NOM008"].includes(fund.code ?? "")) ?? [];
  const sidebarForeign = data?.foreignFunds.slice(0, 2) ?? [];
  const dashboardStatus = data?.lastRefresh?.status === "failed" ? "更新失敗" : data?.lastRefresh?.status === "partial" ? "部分資料更新" : "每日自動更新";

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-dot" />投資儀表板<span className="public-label">PUBLIC</span></div>
        <div className="topbar-right">
          <span id="last-update">{dashboardStatus}：{formatDateTime(data?.lastRefresh?.finishedAt)}</span>
          <span id="globalTime">{now.toLocaleTimeString("zh-TW", { hour12: false })}</span>
          <button className="refresh-btn" onClick={() => refetch()} disabled={isFetching}>{isFetching ? "更新中" : "↻ 更新"}</button>
        </div>
      </header>

      <aside className="sidebar" aria-label="市場摘要">
        <div className="sb-label">全球指數</div>
        {sidebarMarket.map(item => (
          <button className="sb-item" key={item.ticker} onClick={() => setActiveTab("asia")}>
            <div><div className="sb-code">{item.ticker.replace("^", "")}</div><div className="sb-name">{item.name}</div><div className="sb-ts">{item.quoteDate || "--"}</div></div>
            <div><div className={`sb-price ${valueClass(item.percentChange)}`}>{formatNumber(item.price)}</div><div className={`sb-chg ${valueClass(item.percentChange)}`}>{returnText(item.percentChange)}</div></div>
          </button>
        ))}
        <div className="sb-label">台股個股</div>
        {sidebarStocks.map(item => (
          <button className="sb-item" key={item.ticker} onClick={() => setActiveTab("asia")}>
            <div><div className="sb-code">{item.ticker}</div><div className="sb-name">{item.name}</div><div className="sb-ts">{item.quoteDate || "--"}</div></div>
            <div><div className={`sb-price ${valueClass(item.percentChange)}`}>{formatNumber(item.price)}</div><div className={`sb-chg ${valueClass(item.percentChange)}`}>{returnText(item.percentChange)}</div></div>
          </button>
        ))}
        <div className="sb-label">國內基金</div>
        {sidebarDomestic.map(fund => <button className="sb-item" key={fund.id} onClick={() => setActiveTab("domestic")}><div><div className="sb-code">{fund.code}</div><div className="sb-name">{fund.name.replace("基金", "")}</div><div className="sb-ts">{formatDate(fund.asOfDate)}</div></div><div className="sb-price">{formatNumber(fund.nav)}</div></button>)}
        <div className="sb-label">國際基金</div>
        {sidebarForeign.map(fund => <button className="sb-item" key={fund.id} onClick={() => setActiveTab("foreign")}><div><div className="sb-code">境外</div><div className="sb-name">{fund.name.replace("基金", "")}</div><div className="sb-ts">{formatDate(fund.asOfDate)}</div></div><div className="sb-price">{formatNumber(fund.nav, 4)}</div></button>)}
      </aside>

      <main className="main">
        <nav className="tab-nav" aria-label="投資儀表板頁籤">
          {tabs.map(tab => <button className={`tab ${activeTab === tab.key ? "active" : ""}`} key={tab.key} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>)}
        </nav>

        {isLoading ? <div className="loading-state">正在讀取公開資料庫…</div> : null}

        {activeTab === "asia" && <section className="panel active">
          <MarketCards market={data?.market ?? []} cardOrder={marketCardOrder} onCardOrderChange={saveMarketCardOrder} />
          <div className="sec-title">台股個股 / 全球指數</div>
          <div className="table-wrap"><table className="dtable"><thead><tr><th>代碼</th><th className="left">名稱</th><th>現價</th><th>漲跌</th><th>漲跌幅</th><th>更新時間</th><th>狀態</th></tr></thead><tbody>
            {(data?.market ?? []).map(item => <tr key={item.ticker}><td><span className="t-code">{item.ticker}</span></td><td className="left"><span className="t-name">{item.name}</span></td><td><span className={`t-price ${valueClass(item.percentChange)}`}>{formatNumber(item.price)}</span></td><td><span className={`t-chg ${valueClass(item.percentChange)}`}>{item.change === null ? "--" : `${item.change > 0 ? "+" : ""}${formatNumber(item.change)}`}</span></td><td><span className={`badge badge-${valueClass(item.percentChange)}`}>{returnText(item.percentChange)}</span></td><td className="t-ts"><span className="ts-dot live" />{item.quoteDate || "--"}</td><td><span className="badge badge-live">已更新</span></td></tr>)}
          </tbody></table></div>
        </section>}

        {activeTab === "domestic" && <section className="panel active"><div className="sec-title">國內基金 — 最新淨值與多期間報酬</div><p className="fund-hint">每張基金卡片同步顯示一週、一個月、三個月、半年與一年漲跌幅；尚未取得的期間顯示「--」。</p><div className="fund-grid">{(data?.domesticFunds ?? []).map(fund => <FundCard key={fund.id} fund={fund} />)}</div></section>}

        {activeTab === "foreign" && <section className="panel active"><div className="sec-title">國際基金 — 最新淨值與多期間報酬</div><p className="fund-hint">報酬率以基金原幣淨值計算；尚未取得的期間顯示「--」。</p><div className="fund-grid">{(data?.foreignFunds ?? []).map(fund => <FundCard key={fund.id} fund={fund} />)}</div></section>}

        {activeTab === "performance" && <section className="panel active"><MarketCards market={data?.market ?? []} cardOrder={marketCardOrder} onCardOrderChange={saveMarketCardOrder} /><div className="sec-title">一週與一年漲跌幅排行</div><div className="table-wrap"><table className="dtable"><thead><tr><th>代碼</th><th className="left">名稱</th><th>淨值</th><th>日期</th><th>一週漲跌幅</th><th>一年漲跌幅</th><th>年度排名</th></tr></thead><tbody>{weeklyRanking.map(fund => <tr key={fund.id}><td><span className="t-code">{fund.code || "境外"}</span></td><td className="left"><span className="t-name">{fund.name}</span></td><td><span className="t-price">{fund.currency === "TWD" ? "" : `${fund.currency} `}{formatNumber(fund.nav, fund.currency === "TWD" ? 2 : 4)}</span></td><td className="t-ts">{formatDate(fund.asOfDate)}</td><td><span className={`badge badge-${valueClass(fund.perf.week)}`}>{returnText(fund.perf.week)}</span></td><td><span className={`badge badge-${valueClass(fund.perf.year)}`}>{returnText(fund.perf.year)}</span></td><td className="t-ts">{fund.annualRank ? `${fund.annualRank} / ${fund.annualTotal}` : "--"}</td></tr>)}</tbody></table></div></section>}

        {activeTab === "news" && <section className="panel active"><div className="sec-title">財經即時新聞</div><div className="news-list">{(data?.news ?? []).length === 0 ? <div className="empty-inline">等待每日 RSS 更新。</div> : (data?.news ?? []).map(item => <article className="news-item" key={item.id}><a className="news-title" href={item.url} target="_blank" rel="noreferrer">{item.title}</a>{item.summary ? <p className="news-body">{item.summary}</p> : null}<div className="news-meta"><span>{formatDateTime(item.publishedAt)}</span><span>{item.source}</span></div></article>)}</div></section>}
      </main>
    </div>
  );
}
