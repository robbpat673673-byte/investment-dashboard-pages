import { AIChatBox, type Message } from "@/components/AIChatBox";
import { appendObservatoryMessage, createObservatoryChatRequest, OBSERVATORY_CHAT_ERROR, OBSERVATORY_GREETING } from "@/lib/observatoryChat";
import { OBSERVATORY_CHAT_HISTORY_KEY, parseObservatoryChatHistory, serializeObservatoryChatHistory, upsertObservatoryChatSession, type ObservatoryChatSession } from "@/lib/observatoryChatHistory";
import { OBSERVATORY_ALERT_HISTORY_KEY, mergeAlertHistory, parseAlertHistory, serializeAlertHistory } from "@/lib/observatoryAlertHistory";
import { DEFAULT_ALERT_PREFERENCES, OBSERVATORY_ALERTS_KEY, OBSERVATORY_ALERT_STATE_KEY, alertDispositionKey, findTriggeredAlerts, parseAlertDisposition, parseAlertPreferences, requestObservatoryNotification, serializeAlertDisposition, serializeAlertPreferences, type ObservatoryAlertDisposition, type ObservatoryAlertPreferences } from "@/lib/observatoryAlerts";
import { filterMacroHistoryByDays, OBSERVATORY_CHART_RANGE_KEY, parseChartRange, serializeChartRange, type ObservatoryChartRange } from "@/lib/observatoryChart";
import { trpc } from "@/lib/trpc";
import { Bell, BellRing } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type ObservatoryData = {
  asOf: string | null;
  pulse: "偏多" | "偏弱" | "中性";
  breadth: { upCount: number; downCount: number; flatCount: number; total: number };
  highlights: Array<{ ticker: string; name: string; price: number | null; percentChange: number | null; quoteDate: string | null }>;
  headlines: Array<{ title: string; source: string; url: string; publishedAt: Date | string | null }>;
  sources: Array<{ label: string; detail: string; url: string | null }>;
  macroHistory: Array<{ ticker: string; date: string; close: number }>;
  dailySummary: { summaryDate: Date | string; generatedAt: Date | string; content: string } | null;
};

type DailySummary = { id: number; summaryDate: Date | string; generatedAt: Date | string; snapshotAsOf: Date | string | null; content: string; sources: unknown[] };

const number = (value: number | null) => value === null ? "--" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value);
const percent = (value: number | null) => value === null ? "--" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
const tone = (value: number | null) => value === null || value === 0 ? "flat" : value > 0 ? "up" : "down";
const time = (value: string | Date | null) => value ? new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) : "等待資料更新";
const dateKey = (value: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
const dateLabel = (value: string | Date) => new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
const isMacro = (ticker: string) => ["TWD=X", "DX-Y.NYB", "^IRX", "^TNX", "^TYX"].includes(ticker);
const QUICK_PROMPTS = ["分析今日摘要", "依本頁資料整理今日市場趨勢", "美元指數、台幣與美債殖利率有何變化？", "請生成今日財經摘要重點", "哪些新聞線索值得持續追蹤？", "請說明目前資料的風險與限制"];
const CHART_RANGES = [{ value: "1M", label: "1個月", days: 31 }, { value: "3M", label: "3個月", days: 92 }, { value: "6M", label: "6個月", days: 184 }, { value: "1Y", label: "1年", days: 366 }] as const;

export function ObservatoryPanel({ data, onOpenAlertHistory }: { data: ObservatoryData | undefined; onOpenAlertHistory?: () => void }) {
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: OBSERVATORY_GREETING }]);
  const [chatHistory, setChatHistory] = useState<ObservatoryChatSession[]>(() => parseObservatoryChatHistory(typeof window === "undefined" ? null : window.localStorage.getItem(OBSERVATORY_CHAT_HISTORY_KEY)));
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const chat = trpc.observatory.chat.useMutation({
    onSuccess: response => setMessages(current => appendObservatoryMessage(current, "assistant", response.answer)),
    onError: (error: { message?: string }) => setMessages(current => appendObservatoryMessage(current, "assistant", error.message?.includes("上限") || error.message?.includes("頻繁") ? "提問過於頻繁，請稍後再試。" : OBSERVATORY_CHAT_ERROR)),
  });
  const history = trpc.observatory.summaryHistory.useQuery({ limit: 30 });
  const selectedSummary = trpc.observatory.summaryByDate.useQuery({ date: selectedDate ?? "1970-01-01" }, { enabled: Boolean(selectedDate) });
  const generateSummary = trpc.observatory.generateDailySummary.useMutation({
    onSuccess: summary => {
      setSummaryError(null);
      setSelectedDate(dateKey(summary.summaryDate));
      void history.refetch();
    },
    onError: (error: { message?: string }) => setSummaryError(error.message || "每日財經摘要生成失敗，請稍後再試。"),
  });
  const selectedFromHistory = useMemo(() => history.data?.find(item => dateKey(item.summaryDate) === selectedDate) ?? null, [history.data, selectedDate]);
  const displayedSummary = selectedSummary.data ?? selectedFromHistory;
  const [alertPreferences, setAlertPreferences] = useState<ObservatoryAlertPreferences>(() => parseAlertPreferences(typeof window === "undefined" ? null : window.localStorage.getItem(OBSERVATORY_ALERTS_KEY)));
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [alertDisposition, setAlertDisposition] = useState<ObservatoryAlertDisposition>(() => parseAlertDisposition(typeof window === "undefined" ? null : window.localStorage.getItem(OBSERVATORY_ALERT_STATE_KEY)));
  const [chartRange, setChartRange] = useState<ObservatoryChartRange>(() => parseChartRange(typeof window === "undefined" ? null : window.localStorage.getItem(OBSERVATORY_CHART_RANGE_KEY)));
  const rangeDays = chartRange === "1M" ? 31 : chartRange === "3M" ? 92 : chartRange === "6M" ? 184 : 366;
  const yieldCurveData = useMemo(() => {
    const byDate = new Map<string, { date: string; short?: number; tenYear?: number; long?: number }>();
    for (const point of data?.macroHistory ?? []) {
      if (!["^IRX", "^TNX", "^TYX"].includes(point.ticker)) continue;
      const row = byDate.get(point.date) ?? { date: point.date };
      if (point.ticker === "^IRX") row.short = point.close;
      if (point.ticker === "^TNX") row.tenYear = point.close;
      if (point.ticker === "^TYX") row.long = point.close;
      byDate.set(point.date, row);
    }
    return filterMacroHistoryByDays(Array.from(byDate.values()), rangeDays);
  }, [data?.macroHistory, rangeDays]);
  const fxHistoryData = useMemo(() => filterMacroHistoryByDays((data?.macroHistory ?? []).filter(point => point.ticker === "TWD=X").map(point => ({ date: point.date, rate: point.close })), rangeDays), [data?.macroHistory, rangeDays]);
  const triggeredAlerts = useMemo(() => data ? findTriggeredAlerts(data.highlights, alertPreferences) : [], [data, alertPreferences]);
  const visibleTriggeredAlerts = useMemo(() => triggeredAlerts.filter(item => !alertDisposition.ignored.includes(alertDispositionKey(item))), [triggeredAlerts, alertDisposition.ignored]);
  const ignoredTriggeredAlerts = useMemo(() => triggeredAlerts.filter(item => alertDisposition.ignored.includes(alertDispositionKey(item))), [triggeredAlerts, alertDisposition.ignored]);
  const alertSource = data?.sources.find(source => source.label.includes("行情") || source.detail.includes("Yahoo"))?.label ?? "Yahoo Finance";

  useEffect(() => {
    window.localStorage.setItem(OBSERVATORY_ALERTS_KEY, serializeAlertPreferences(alertPreferences));
  }, [alertPreferences]);

  useEffect(() => {
    window.localStorage.setItem(OBSERVATORY_CHART_RANGE_KEY, serializeChartRange(chartRange));
  }, [chartRange]);

  useEffect(() => {
    if (!triggeredAlerts.length) return;
    const existing = parseAlertHistory(window.localStorage.getItem(OBSERVATORY_ALERT_HISTORY_KEY));
    const incoming = triggeredAlerts.map(item => ({ key: alertDispositionKey(item), ticker: item.ticker, name: item.name, percentChange: item.percentChange, quoteDate: item.quoteDate ?? null, source: alertSource, triggeredAt: new Date().toISOString() }));
    window.localStorage.setItem(OBSERVATORY_ALERT_HISTORY_KEY, serializeAlertHistory(mergeAlertHistory(existing, incoming)));
  }, [alertSource, triggeredAlerts]);

  useEffect(() => {
    if (!messages.some(message => message.role === "user")) return;
    const next = upsertObservatoryChatSession(chatHistory, messages, activeChatId);
    setChatHistory(next);
    window.localStorage.setItem(OBSERVATORY_CHAT_HISTORY_KEY, serializeObservatoryChatHistory(next));
    if (next[0]) setActiveChatId(next[0].id);
  }, [messages]);

  useEffect(() => {
    window.localStorage.setItem(OBSERVATORY_ALERT_STATE_KEY, serializeAlertDisposition(alertDisposition));
  }, [alertDisposition]);

  useEffect(() => {
    if (!data || !alertPreferences.enabled || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (visibleTriggeredAlerts.length === 0) return;
    const signature = visibleTriggeredAlerts.map(item => `${item.ticker}:${item.percentChange}`).join("|");
    if (window.localStorage.getItem("observatory-last-alert") === signature) return;
    new Notification("投資儀表板異常提醒", { body: visibleTriggeredAlerts.map(item => `${item.name} ${percent(item.percentChange)}`).join("、") });
    window.localStorage.setItem("observatory-last-alert", signature);
  }, [data, alertPreferences, visibleTriggeredAlerts]);

  const markAlertRead = (key: string) => setAlertDisposition(current => ({ ...current, read: current.read.includes(key) ? current.read : [...current.read, key] }));
  const ignoreAlert = (key: string) => setAlertDisposition(current => ({ ...current, ignored: current.ignored.includes(key) ? current.ignored : [...current.ignored, key] }));
  const restoreAlert = (key: string) => setAlertDisposition(current => ({ ...current, ignored: current.ignored.filter(item => item !== key) }));

  const requestNotifications = async () => {
    const result = await requestObservatoryNotification();
    if (result.permission === "granted") setAlertPreferences(current => ({ ...current, enabled: true }));
    setNotificationMessage(result.message);
  };

  const send = (content: string) => {
    const next = appendObservatoryMessage(messages, "user", content);
    if (next === messages) return;
    setMessages(next);
    chat.mutate({ messages: createObservatoryChatRequest(next) });
  };

  const startNewChat = () => {
    setActiveChatId(null);
    setMessages([{ role: "assistant", content: OBSERVATORY_GREETING }]);
  };
  const selectChat = (session: ObservatoryChatSession) => {
    setActiveChatId(session.id);
    setMessages(session.messages);
  };

  if (!data) return <div className="empty-inline">等待觀測站資料載入。</div>;
  const pulseClass = data.pulse === "偏多" ? "up" : data.pulse === "偏弱" ? "down" : "flat";
  return <section className="panel active observatory-panel">
    <div className="observatory-hero">
      <div><span className="observatory-kicker">財經小智 · Market Observatory</span><h1>觀測站</h1><p>以本儀表板的市場行情與 RSS 新聞建立可追溯的今日觀察，將「事實」、「觀察」與「限制」分層呈現。</p></div>
      <div className={`observatory-pulse ${pulseClass}`}><span>市場廣度</span><strong>{data.pulse}</strong><small>上 {data.breadth.upCount} · 下 {data.breadth.downCount} · 平 {data.breadth.flatCount}</small></div>
    </div>

    <div className="observatory-meta"><span>資料快照：{time(data.asOf)}</span><span>時區：Asia/Taipei</span></div>
    <div className="observatory-grid">
      <section className="observatory-section"><div className="detail-section-title"><span>重點行情與總經指標</span><small>資料來源：Yahoo Finance</small></div><div className="observatory-market-grid">{data.highlights.map(item => <article className={isMacro(item.ticker) ? "macro-quote" : ""} key={item.ticker}><span>{item.name}</span><strong className={tone(item.percentChange)}>{number(item.price)}{item.ticker === "^TNX" || item.ticker === "^TYX" || item.ticker === "^IRX" ? "%" : ""}</strong><small className={tone(item.percentChange)}>{percent(item.percentChange)} · {item.quoteDate ?? "--"}</small></article>)}</div></section>
      <section className="observatory-section observatory-macro-section">
        <div className="detail-section-title"><span>總經歷史圖表</span><small>資料來源：Yahoo Finance；{chartRange === "1Y" ? "最近 1 年" : `最近 ${CHART_RANGES.find(item => item.value === chartRange)?.label}`}交易日</small></div>
        <div className="observatory-chart-range" role="group" aria-label="總經圖表時間區間">{CHART_RANGES.map(item => <button key={item.value} type="button" className={chartRange === item.value ? "selected" : ""} onClick={() => setChartRange(item.value)}>{item.label}</button>)}</div>
        <div className="observatory-chart-grid">
          <article className="observatory-chart-card"><strong>美國公債殖利率曲線</strong><div className="observatory-chart-legend"><span>13週</span><span>10年</span><span>30年</span></div>{yieldCurveData.length ? <ResponsiveContainer width="100%" height={220}><LineChart data={yieldCurveData}><CartesianGrid strokeDasharray="3 3" opacity={0.25} /><XAxis dataKey="date" hide /><YAxis width={42} tickFormatter={value => `${Number(value).toFixed(1)}%`} /><Tooltip formatter={(value: number) => `${value.toFixed(3)}%`} labelFormatter={label => `日期 ${label}`} /><Line type="monotone" dataKey="short" stroke="#7c3aed" dot={false} strokeWidth={2} name="13週" /><Line type="monotone" dataKey="tenYear" stroke="#2563eb" dot={false} strokeWidth={2} name="10年" /><Line type="monotone" dataKey="long" stroke="#0891b2" dot={false} strokeWidth={2} name="30年" /></LineChart></ResponsiveContainer> : <p className="empty-inline">等待殖利率歷史資料。</p>}</article>
          <article className="observatory-chart-card"><strong>美元／台幣歷史走勢</strong><small>美元兌台幣（TWD=X）</small>{fxHistoryData.length ? <ResponsiveContainer width="100%" height={220}><LineChart data={fxHistoryData}><CartesianGrid strokeDasharray="3 3" opacity={0.25} /><XAxis dataKey="date" hide /><YAxis width={52} domain={["auto", "auto"]} /><Tooltip formatter={(value: number) => value.toFixed(4)} labelFormatter={label => `日期 ${label}`} /><Line type="monotone" dataKey="rate" stroke="#d97706" dot={false} strokeWidth={2} name="USD/TWD" /></LineChart></ResponsiveContainer> : <p className="empty-inline">等待美元／台幣歷史資料。</p>}</article>
        </div>
      </section>
      <section className="observatory-section"><div className="detail-section-title"><span>今日新聞線索</span><small>資料來源：Google News RSS</small></div><div className="observatory-headlines">{data.headlines.length === 0 ? <p>目前沒有可用新聞資料。</p> : data.headlines.map(item => <a key={`${item.url}-${item.title}`} href={item.url} target="_blank" rel="noreferrer"><strong>{item.title}</strong><span>{item.source}</span></a>)}</div></section>
    </div>

    <section className="observatory-alert-section"><div className="detail-section-title"><span>{alertPreferences.enabled ? <BellRing size={17} /> : <Bell size={17} />} 異常通知設定</span><small>設定保存在此瀏覽器</small></div><div className="observatory-alert-controls"><label><input type="checkbox" checked={alertPreferences.enabled} onChange={event => setAlertPreferences(current => ({ ...current, enabled: event.target.checked }))} /> 啟用市場與總經異常提醒</label><label>市場變動門檻 <input type="number" min="0.1" max="20" step="0.1" value={alertPreferences.marketThreshold} onChange={event => setAlertPreferences(current => ({ ...current, marketThreshold: Number(event.target.value) }))} />%</label><label>總經指標門檻 <input type="number" min="0.1" max="10" step="0.1" value={alertPreferences.macroThreshold} onChange={event => setAlertPreferences(current => ({ ...current, macroThreshold: Number(event.target.value) }))} />%</label><button className="button outline" type="button" onClick={() => void requestNotifications()}>允許瀏覽器通知</button>{onOpenAlertHistory ? <button className="button outline" type="button" onClick={onOpenAlertHistory}>查看警示歷史</button> : null}</div>{notificationMessage ? <p className="observatory-alert-message">{notificationMessage}</p> : <p className="observatory-alert-help">僅在瀏覽器允許通知、且最新資料超過門檻時提醒；不會在未經使用者操作下要求權限。</p>}</section>

    <section className={visibleTriggeredAlerts.length > 0 || ignoredTriggeredAlerts.length > 0 ? "observatory-alert-banners" : "observatory-alert-empty"} aria-live="polite">{visibleTriggeredAlerts.length > 0 ? <><strong>異常警示</strong><div className="observatory-alert-list">{visibleTriggeredAlerts.map(item => { const key = alertDispositionKey(item); const isRead = alertDisposition.read.includes(key); return <article className={`observatory-alert-item ${isRead ? "read" : ""}`} key={key}><div className="observatory-alert-badge-row"><span className={`observatory-alert-badge ${isMacro(item.ticker) ? "macro" : "market"}`}><BellRing size={14} />{item.name} {percent(item.percentChange)}（門檻已觸發）</span><span className="observatory-alert-status">{isRead ? "已讀" : "未讀"}</span></div><small>觸發日期：{item.quoteDate ?? "--"} · 資料來源：{alertSource}</small><div className="observatory-alert-actions">{!isRead ? <button type="button" onClick={() => markAlertRead(key)}>標記為已讀</button> : null}<button type="button" onClick={() => ignoreAlert(key)}>忽略</button></div></article>})}</div></> : null}{ignoredTriggeredAlerts.length > 0 ? <details className="observatory-alert-ignored"><summary>已忽略 {ignoredTriggeredAlerts.length} 則警示</summary>{ignoredTriggeredAlerts.map(item => { const key = alertDispositionKey(item); return <div key={key}><span>{item.name} · {item.quoteDate ?? "--"}</span><button type="button" onClick={() => restoreAlert(key)}>復原</button></div>})}</details> : null}{visibleTriggeredAlerts.length === 0 && ignoredTriggeredAlerts.length === 0 ? <span>目前沒有標的超過已設定的市場／總經門檻。</span> : null}</section>

    <section className="observatory-summary-section">
      <div className="detail-section-title"><span>每日財經摘要</span><small>依目前快照生成並保存至歷史紀錄</small></div>
      <div className="observatory-summary-actions"><button className="button primary" type="button" onClick={() => generateSummary.mutate()} disabled={generateSummary.isPending}>{generateSummary.isPending ? "生成中…" : "一鍵生成今日摘要"}</button><span>摘要會標示資料日期、來源與限制，當日再次生成會更新同一筆紀錄。</span></div>
      {summaryError ? <p className="observatory-error">{summaryError}</p> : null}
      <div className="observatory-history-layout"><div className="observatory-history-list"><strong>歷史紀錄</strong>{history.isLoading ? <p>讀取中…</p> : history.data?.length ? history.data.map(item => <button className={dateKey(item.summaryDate) === selectedDate ? "selected" : ""} type="button" key={item.id} onClick={() => setSelectedDate(dateKey(item.summaryDate))}><span>{dateLabel(item.summaryDate)}</span><small>{time(item.generatedAt)}</small></button>) : <p>尚無摘要紀錄，請先生成今日摘要。</p>}</div><article className="observatory-summary-view">{displayedSummary ? <><div className="summary-view-meta"><strong>{dateLabel(displayedSummary.summaryDate)} 每日財經摘要</strong><span>生成時間：{time(displayedSummary.generatedAt)}</span></div><div className="summary-content">{displayedSummary.content.split("\n").map((line, index) => <p key={`${index}-${line}`}>{line || " "}</p>)}</div></> : <p>選擇左側歷史紀錄即可查看已存檔摘要。</p>}</article></div>
    </section>

    <div className="observatory-chat-layout">
      <section className="observatory-chat-intro"><span className="observatory-kicker">交談式整理</span><h2>詢問財經小智</h2><p>可請它整理市場趨勢、解讀本頁新聞脈絡，或說明目前資料限制。回覆僅基於本頁快照，並會附上來源與風險限制。</p><ul><li>市場趨勢：以當前資料快照說明上漲與下跌標的。</li><li>總經解讀：查看匯率、美元指數與殖利率的當日變化。</li><li>新聞摘要：依本頁列出的 RSS 新聞標題與來源整理。</li></ul><div className="observatory-chat-history" aria-label="財經小智對話歷史"><div className="observatory-chat-history-header"><strong>對話歷史</strong><button className="button outline" type="button" onClick={startNewChat}>新對話</button></div>{chatHistory.length === 0 ? <p>送出第一個問題後，對話會保存在此瀏覽器。</p> : <div className="observatory-chat-history-list">{chatHistory.map(session => <button className={session.id === activeChatId ? "selected" : ""} type="button" key={session.id} onClick={() => selectChat(session)}><strong>{session.title}</strong><small>{time(session.updatedAt)}</small></button>)}</div>}</div><div className="observatory-quick-prompts" aria-label="財經小智快速提問"><strong>快速提問</strong><div>{QUICK_PROMPTS.map(prompt => <button key={prompt} type="button" onClick={() => send(prompt)} disabled={chat.isPending}>{prompt}</button>)}</div></div></section>
      <AIChatBox messages={messages} onSendMessage={send} isLoading={chat.isPending} height="470px" className="observatory-chat" placeholder="例如：依本頁資料整理今日市場觀察" />
    </div>

    <section className="observatory-sources"><div className="detail-section-title"><span>資料來源與使用限制</span><small>可追溯資料</small></div>{data.sources.map(source => <div className="observatory-source" key={source.label}><div><strong>{source.label}</strong><p>{source.detail}</p></div>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">開啟來源</a> : null}</div>)}<p className="observatory-disclaimer">本頁內容為資料整理與一般性研究觀察，並非個人化投資建議。市場有風險，重要決策前請自行查證並諮詢合格專業人士。</p></section>
  </section>;
}
