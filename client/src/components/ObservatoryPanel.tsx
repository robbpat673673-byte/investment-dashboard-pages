import { AIChatBox, type Message } from "@/components/AIChatBox";
import { appendObservatoryMessage, createObservatoryChatRequest, OBSERVATORY_CHAT_ERROR, OBSERVATORY_GREETING } from "@/lib/observatoryChat";
import { trpc } from "@/lib/trpc";
import React, { useState } from "react";

type ObservatoryData = {
  asOf: string | null;
  pulse: "偏多" | "偏弱" | "中性";
  breadth: { upCount: number; downCount: number; flatCount: number; total: number };
  highlights: Array<{ ticker: string; name: string; price: number | null; percentChange: number | null; quoteDate: string | null }>;
  headlines: Array<{ title: string; source: string; url: string; publishedAt: Date | string | null }>;
  sources: Array<{ label: string; detail: string; url: string | null }>;
};

const number = (value: number | null) => value === null ? "--" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value);
const percent = (value: number | null) => value === null ? "--" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
const tone = (value: number | null) => value === null || value === 0 ? "flat" : value > 0 ? "up" : "down";
const time = (value: string | null) => value ? new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) : "等待資料更新";

export function ObservatoryPanel({ data }: { data: ObservatoryData | undefined }) {
  const [messages, setMessages] = useState<Message[]>([{
    role: "assistant",
    content: OBSERVATORY_GREETING,
  }]);
  const chat = trpc.observatory.chat.useMutation({
    onSuccess: response => setMessages(current => appendObservatoryMessage(current, "assistant", response.answer)),
    onError: () => setMessages(current => appendObservatoryMessage(current, "assistant", OBSERVATORY_CHAT_ERROR)),
  });
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
      <section className="observatory-section"><div className="detail-section-title"><span>市場資料快照</span><small>資料來源：Yahoo Finance</small></div><div className="observatory-market-grid">{data.highlights.map(item => <article key={item.ticker}><span>{item.name}</span><strong className={tone(item.percentChange)}>{number(item.price)}</strong><small className={tone(item.percentChange)}>{percent(item.percentChange)} · {item.quoteDate ?? "--"}</small></article>)}</div></section>
      <section className="observatory-section"><div className="detail-section-title"><span>今日新聞線索</span><small>資料來源：Google News RSS</small></div><div className="observatory-headlines">{data.headlines.length === 0 ? <p>目前沒有可用新聞資料。</p> : data.headlines.map(item => <a key={`${item.url}-${item.title}`} href={item.url} target="_blank" rel="noreferrer"><strong>{item.title}</strong><span>{item.source}</span></a>)}</div></section>
    </div>

    <div className="observatory-chat-layout">
      <section className="observatory-chat-intro"><span className="observatory-kicker">交談式整理</span><h2>詢問財經小智</h2><p>可請它整理市場趨勢、解讀本頁新聞脈絡，或說明目前資料限制。回覆僅基於本頁快照，並會附上來源與風險限制。</p><ul><li>市場趨勢：以當前資料快照說明上漲與下跌標的。</li><li>風險觀察：辨識資料所反映的集中或分歧現象，不作預測。</li><li>新聞摘要：依本頁列出的 RSS 新聞標題與來源整理。</li></ul></section>
      <AIChatBox messages={messages} onSendMessage={send} isLoading={chat.isPending} height="470px" className="observatory-chat" placeholder="例如：依本頁資料整理今日市場觀察" suggestedPrompts={["依本頁資料整理今日市場趨勢", "哪些新聞線索值得持續追蹤？", "請說明目前資料的風險與限制"]} />
    </div>

    <section className="observatory-sources"><div className="detail-section-title"><span>資料來源與使用限制</span><small>可追溯資料</small></div>{data.sources.map(source => <div className="observatory-source" key={source.label}><div><strong>{source.label}</strong><p>{source.detail}</p></div>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">開啟來源</a> : null}</div>)}<p className="observatory-disclaimer">本頁內容為資料整理與一般性研究觀察，並非個人化投資建議。市場有風險，重要決策前請自行查證並諮詢合格專業人士。</p></section>
  </section>;
}
