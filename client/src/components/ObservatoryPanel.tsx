import { AIChatBox, type Message } from "@/components/AIChatBox";
import { appendObservatoryMessage, createObservatoryChatRequest, OBSERVATORY_CHAT_ERROR, OBSERVATORY_GREETING } from "@/lib/observatoryChat";
import { trpc } from "@/lib/trpc";
import React, { useMemo, useState } from "react";

type ObservatoryData = {
  asOf: string | null;
  pulse: "偏多" | "偏弱" | "中性";
  breadth: { upCount: number; downCount: number; flatCount: number; total: number };
  highlights: Array<{ ticker: string; name: string; price: number | null; percentChange: number | null; quoteDate: string | null }>;
  headlines: Array<{ title: string; source: string; url: string; publishedAt: Date | string | null }>;
  sources: Array<{ label: string; detail: string; url: string | null }>;
};

type DailySummary = { id: number; summaryDate: Date | string; generatedAt: Date | string; snapshotAsOf: Date | string | null; content: string; sources: unknown[] };

const number = (value: number | null) => value === null ? "--" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value);
const percent = (value: number | null) => value === null ? "--" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
const tone = (value: number | null) => value === null || value === 0 ? "flat" : value > 0 ? "up" : "down";
const time = (value: string | Date | null) => value ? new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) : "等待資料更新";
const dateKey = (value: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
const dateLabel = (value: string | Date) => new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
const isMacro = (ticker: string) => ["TWD=X", "DX-Y.NYB", "^IRX", "^TNX", "^TYX"].includes(ticker);

export function ObservatoryPanel({ data }: { data: ObservatoryData | undefined }) {
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: OBSERVATORY_GREETING }]);
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

  const send = (content: string) => {
    const next = appendObservatoryMessage(messages, "user", content);
    if (next === messages) return;
    setMessages(next);
    chat.mutate({ messages: createObservatoryChatRequest(next) });
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
      <section className="observatory-section"><div className="detail-section-title"><span>今日新聞線索</span><small>資料來源：Google News RSS</small></div><div className="observatory-headlines">{data.headlines.length === 0 ? <p>目前沒有可用新聞資料。</p> : data.headlines.map(item => <a key={`${item.url}-${item.title}`} href={item.url} target="_blank" rel="noreferrer"><strong>{item.title}</strong><span>{item.source}</span></a>)}</div></section>
    </div>

    <section className="observatory-summary-section">
      <div className="detail-section-title"><span>每日財經摘要</span><small>依目前快照生成並保存至歷史紀錄</small></div>
      <div className="observatory-summary-actions"><button className="button primary" type="button" onClick={() => generateSummary.mutate()} disabled={generateSummary.isPending}>{generateSummary.isPending ? "生成中…" : "一鍵生成今日摘要"}</button><span>摘要會標示資料日期、來源與限制，當日再次生成會更新同一筆紀錄。</span></div>
      {summaryError ? <p className="observatory-error">{summaryError}</p> : null}
      <div className="observatory-history-layout"><div className="observatory-history-list"><strong>歷史紀錄</strong>{history.isLoading ? <p>讀取中…</p> : history.data?.length ? history.data.map(item => <button className={dateKey(item.summaryDate) === selectedDate ? "selected" : ""} type="button" key={item.id} onClick={() => setSelectedDate(dateKey(item.summaryDate))}><span>{dateLabel(item.summaryDate)}</span><small>{time(item.generatedAt)}</small></button>) : <p>尚無摘要紀錄，請先生成今日摘要。</p>}</div><article className="observatory-summary-view">{displayedSummary ? <><div className="summary-view-meta"><strong>{dateLabel(displayedSummary.summaryDate)} 每日財經摘要</strong><span>生成時間：{time(displayedSummary.generatedAt)}</span></div><div className="summary-content">{displayedSummary.content.split("\n").map((line, index) => <p key={`${index}-${line}`}>{line || " "}</p>)}</div></> : <p>選擇左側歷史紀錄即可查看已存檔摘要。</p>}</article></div>
    </section>

    <div className="observatory-chat-layout">
      <section className="observatory-chat-intro"><span className="observatory-kicker">交談式整理</span><h2>詢問財經小智</h2><p>可請它整理市場趨勢、解讀本頁新聞脈絡，或說明目前資料限制。回覆僅基於本頁快照，並會附上來源與風險限制。</p><ul><li>市場趨勢：以當前資料快照說明上漲與下跌標的。</li><li>總經解讀：查看匯率、美元指數與殖利率的當日變化。</li><li>新聞摘要：依本頁列出的 RSS 新聞標題與來源整理。</li></ul></section>
      <AIChatBox messages={messages} onSendMessage={send} isLoading={chat.isPending} height="470px" className="observatory-chat" placeholder="例如：依本頁資料整理今日市場觀察" suggestedPrompts={["依本頁資料整理今日市場趨勢", "美元指數、台幣與美債殖利率有何變化？", "請生成今日財經摘要重點", "哪些新聞線索值得持續追蹤？", "請說明目前資料的風險與限制"]} />
    </div>

    <section className="observatory-sources"><div className="detail-section-title"><span>資料來源與使用限制</span><small>可追溯資料</small></div>{data.sources.map(source => <div className="observatory-source" key={source.label}><div><strong>{source.label}</strong><p>{source.detail}</p></div>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">開啟來源</a> : null}</div>)}<p className="observatory-disclaimer">本頁內容為資料整理與一般性研究觀察，並非個人化投資建議。市場有風險，重要決策前請自行查證並諮詢合格專業人士。</p></section>
  </section>;
}
