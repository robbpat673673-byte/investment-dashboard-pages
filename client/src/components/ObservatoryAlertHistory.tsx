import React, { useEffect, useMemo, useState } from "react";
import { Bell, ChevronLeft } from "lucide-react";
import { alertDispositionKey, parseAlertDisposition, serializeAlertDisposition, type ObservatoryAlertDisposition } from "@/lib/observatoryAlerts";
import { OBSERVATORY_ALERT_HISTORY_KEY, alertHistoryStatus, parseAlertHistory, type ObservatoryAlertHistoryRecord } from "@/lib/observatoryAlertHistory";
import { OBSERVATORY_ALERT_STATE_KEY } from "@/lib/observatoryAlerts";

const formatTriggeredAt = (value: string) => new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));

export function ObservatoryAlertHistory({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState<ObservatoryAlertHistoryRecord[]>(() => parseAlertHistory(window.localStorage.getItem(OBSERVATORY_ALERT_HISTORY_KEY)));
  const [disposition, setDisposition] = useState<ObservatoryAlertDisposition>(() => parseAlertDisposition(window.localStorage.getItem(OBSERVATORY_ALERT_STATE_KEY)));
  const [filter, setFilter] = useState<"all" | "unread" | "read" | "ignored">("all");

  useEffect(() => {
    const reload = () => {
      setRecords(parseAlertHistory(window.localStorage.getItem(OBSERVATORY_ALERT_HISTORY_KEY)));
      setDisposition(parseAlertDisposition(window.localStorage.getItem(OBSERVATORY_ALERT_STATE_KEY)));
    };
    window.addEventListener("storage", reload);
    return () => window.removeEventListener("storage", reload);
  }, []);

  const visibleRecords = useMemo(() => records.filter(record => filter === "all" || alertHistoryStatus(record, disposition) === ({ unread: "未讀", read: "已讀", ignored: "已忽略" } as const)[filter]), [disposition, filter, records]);
  const updateDisposition = (record: ObservatoryAlertHistoryRecord, action: "read" | "ignored" | "restore") => {
    const key = alertDispositionKey({ ticker: record.ticker, percentChange: record.percentChange, quoteDate: record.quoteDate });
    const next: ObservatoryAlertDisposition = {
      read: action === "restore" ? disposition.read.filter(item => item !== key) : Array.from(new Set(action === "read" ? [...disposition.read, key] : disposition.read.filter(item => item !== key))),
      ignored: action === "ignored" ? Array.from(new Set([...disposition.ignored, key])) : disposition.ignored.filter(item => item !== key),
    };
    setDisposition(next);
    window.localStorage.setItem(OBSERVATORY_ALERT_STATE_KEY, serializeAlertDisposition(next));
  };

  return <section className="panel active observatory-alert-history-page">
    <div className="observatory-history-hero"><div><span className="observatory-kicker">Market Observatory</span><h1>警示歷史紀錄</h1><p>查看此瀏覽器曾保存的市場與總經異常通知。紀錄僅代表當時資料快照，不代表目前仍然觸發。</p></div><button className="button outline" type="button" onClick={onBack}><ChevronLeft size={16} />返回觀測站</button></div>
    <div className="observatory-alert-history-toolbar" role="group" aria-label="警示歷史篩選">{[{ value: "all", label: "全部" }, { value: "unread", label: "未讀" }, { value: "read", label: "已讀" }, { value: "ignored", label: "已忽略" }].map(item => <button type="button" key={item.value} className={filter === item.value ? "selected" : ""} onClick={() => setFilter(item.value as typeof filter)}>{item.label}</button>)}</div>
    {visibleRecords.length === 0 ? <div className="observatory-alert-history-empty"><Bell size={20} /><p>目前沒有符合條件的警示歷史紀錄。</p><button className="button outline" type="button" onClick={onBack}>回到觀測站</button></div> : <div className="observatory-alert-history-list">{visibleRecords.map(record => { const status = alertHistoryStatus(record, disposition); return <article className={`observatory-alert-history-card ${status === "已讀" ? "read" : status === "已忽略" ? "ignored" : "unread"}`} key={record.key}><div className="observatory-alert-history-card-head"><strong>{record.name}</strong><span>{status}</span></div><p>{record.percentChange === null ? "--" : `${record.percentChange > 0 ? "+" : ""}${record.percentChange.toFixed(2)}%`} · 觸發日期：{record.quoteDate ?? "--"}</p><small>保存時間：{formatTriggeredAt(record.triggeredAt)} · 資料來源：{record.source}</small><div className="observatory-alert-actions">{status !== "已讀" ? <button type="button" onClick={() => updateDisposition(record, "read")}>標記為已讀</button> : null}{status !== "已忽略" ? <button type="button" onClick={() => updateDisposition(record, "ignored")}>忽略</button> : <button type="button" onClick={() => updateDisposition(record, "restore")}>復原</button>}</div></article>})}</div>}
  </section>;
}
