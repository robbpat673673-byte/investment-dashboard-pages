import React, { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

type StageKey = "funds" | "rss" | "market" | "macro";
type StageStatus = "pending" | "running" | "success" | "partial" | "failed";
type StageView = { status: StageStatus; completed: number; total: number; updated: number };
type RefreshResult = { status: "success" | "partial" | "failed"; fundsUpdated: number; newsUpdated: number; marketUpdated: number; macroPointsUpdated: number; errors: string[]; stages: Record<string, { status: string; updated: number }> };
type RefreshEvent = { type: "started" | "stage-start" | "stage-progress" | "stage-complete" | "complete"; requestId?: string; stage?: StageKey; completed?: number; total?: number; updated?: number; result?: RefreshResult; error?: string };

const stages: Array<{ key: StageKey; label: string }> = [
  { key: "funds", label: "基金" },
  { key: "rss", label: "RSS 新聞" },
  { key: "market", label: "行情" },
  { key: "macro", label: "總經歷史" },
];

function statusLabel(status: StageStatus) {
  return { pending: "等待中", running: "更新中", success: "完成", partial: "部分完成", failed: "失敗" }[status];
}

function initialStages(): Record<StageKey, StageView> {
  return Object.fromEntries(stages.map(stage => [stage.key, { status: "pending", completed: 0, total: 0, updated: 0 }])) as Record<StageKey, StageView>;
}

export function ManualRefreshPanel({ onCompleted }: { onCompleted: () => void }) {
  if (!trpc.auth?.me?.useQuery) return null;
  const { data: user, isLoading: authLoading } = trpc.auth.me.useQuery();
  const sourceRef = useRef<EventSource | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [stageViews, setStageViews] = useState<Record<StageKey, StageView>>(initialStages);
  const [result, setResult] = useState<RefreshResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => () => { sourceRef.current?.close(); }, []);

  const closeStream = () => { sourceRef.current?.close(); sourceRef.current = null; setIsStreaming(false); };
  const applyEvent = (event: RefreshEvent) => {
    if (event.type === "started") { setOpen(true); setStageViews(initialStages()); return; }
    if (event.type === "stage-start" && event.stage) {
      setStageViews(current => ({ ...current, [event.stage!]: { status: "running", completed: event.completed ?? 0, total: event.total ?? 0, updated: 0 } }));
      return;
    }
    if (event.type === "stage-progress" && event.stage) {
      setStageViews(current => ({ ...current, [event.stage!]: { ...current[event.stage!], status: "running", completed: event.completed ?? current[event.stage!].completed, total: event.total ?? current[event.stage!].total, updated: current[event.stage!].updated + (event.updated ?? 0) } }));
      return;
    }
    if (event.type === "stage-complete" && event.stage) {
      setStageViews(current => ({ ...current, [event.stage!]: { ...current[event.stage!], status: (event.updated ?? 0) > 0 ? "success" : "partial", completed: event.completed ?? current[event.stage!].total, total: event.total ?? current[event.stage!].total, updated: event.updated ?? current[event.stage!].updated } }));
      return;
    }
    if (event.type === "complete" && event.result) {
      if (cancelledRef.current) return;
      setResult(event.result);
      setErrorMessage(null);
      setIsStreaming(false);
      sourceRef.current?.close();
      sourceRef.current = null;
      onCompleted();
    }
  };

  const startRefresh = () => {
    closeStream();
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    requestIdRef.current = requestId;
    cancelledRef.current = false;
    setOpen(true); setResult(null); setErrorMessage(null); setStageViews(initialStages()); setIsStreaming(true);
    const source = new EventSource(`/api/admin/refresh/stream?requestId=${encodeURIComponent(requestId)}`);
    sourceRef.current = source;
    source.onmessage = message => {
      try { applyEvent(JSON.parse(message.data) as RefreshEvent); } catch { setErrorMessage("刷新事件格式無法解析。"); }
    };
    source.addEventListener("error", message => {
      const event = message as MessageEvent<RefreshEvent>;
      if (event.data) { try { const payload = JSON.parse(String(event.data)) as RefreshEvent; setErrorMessage(payload.error ?? "伺服器刷新失敗"); } catch { setErrorMessage("伺服器刷新失敗"); } }
    });
    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) { setIsStreaming(false); return; }
      setErrorMessage("SSE 連線中斷，請稍後重試。"); closeStream();
    };
  };

  const cancelRefresh = () => {
    const requestId = requestIdRef.current;
    if (!requestId || !isStreaming) return;
    cancelledRef.current = true;
    setIsStreaming(false);
    setErrorMessage("已要求伺服器取消刷新，正在停止目前工作…");
    void fetch("/api/admin/refresh/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId }) })
      .catch(() => setErrorMessage("取消請求未送達，請重新整理後確認刷新狀態。"))
      .finally(() => { sourceRef.current?.close(); sourceRef.current = null; requestIdRef.current = null; });
  };

  const completedCount = useMemo(() => Object.values(stageViews).filter(stage => stage.status === "success" || stage.status === "partial").length, [stageViews]);
  const progress = isStreaming ? Math.round(stages.reduce((sum, stage) => sum + (stageViews[stage.key].total ? stageViews[stage.key].completed / stageViews[stage.key].total : stageViews[stage.key].status === "success" ? 1 : 0), 0) / stages.length * 100) : result ? 100 : 0;

  if (authLoading || user?.role !== "admin") return null;
  return <section className="manual-refresh-panel" aria-label="手動刷新管理介面">
    <div className="manual-refresh-head"><div><strong>資料刷新管理</strong><small>伺服器 SSE 即時回報每日刷新流程</small></div><button type="button" className="manual-refresh-button" disabled={isStreaming} onClick={startRefresh}>{isStreaming ? "刷新執行中…" : "手動刷新"}</button></div>
    {open ? <div className="manual-refresh-status" aria-live="polite"><div className="manual-refresh-progress-head"><span>{isStreaming ? `伺服器即時處理中 · 已完成 ${completedCount}/${stages.length} 階段` : result ? "刷新完成" : errorMessage?.startsWith("已要求") ? "刷新已取消" : errorMessage ? "刷新失敗" : "尚未執行"}</span><div className="manual-refresh-progress-actions"><strong>{progress}%</strong>{isStreaming ? <button type="button" className="manual-refresh-cancel" onClick={cancelRefresh}>取消</button> : null}</div></div><div className="manual-refresh-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div><div className="manual-refresh-stages">{stages.map(stage => { const view = stageViews[stage.key]; return <div className={`manual-refresh-stage ${view.status}`} key={stage.key}><span className="manual-refresh-stage-dot" aria-hidden="true" /><div><strong>{stage.label}</strong><small>{statusLabel(view.status)}{view.total ? ` · ${view.completed}/${view.total}` : ""}{view.updated ? ` · ${view.updated} 筆` : ""}</small></div></div>; })}</div>{result ? <p className="manual-refresh-summary">結果：基金 {result.fundsUpdated} 檔、RSS {result.newsUpdated} 則、行情 {result.marketUpdated} 項、總經 {result.macroPointsUpdated} 點；{result.errors.length > 0 ? `錯誤 ${result.errors.length} 項。` : "沒有錯誤。"}</p> : null}{errorMessage ? <p className="manual-refresh-error">{errorMessage}</p> : null}{result?.errors.length ? <details className="manual-refresh-errors"><summary>查看錯誤明細（{result.errors.length}）</summary><ul>{result.errors.slice(0, 8).map(error => <li key={error}>{error}</li>)}</ul></details> : null}</div> : null}
  </section>;
}
