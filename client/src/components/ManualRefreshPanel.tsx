import React, { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

type StageKey = "funds" | "rss" | "market" | "macro";
const stages: Array<{ key: StageKey; label: string }> = [
  { key: "funds", label: "基金" },
  { key: "rss", label: "RSS 新聞" },
  { key: "market", label: "行情" },
  { key: "macro", label: "總經歷史" },
];

type StageView = { status: "pending" | "running" | "success" | "partial" | "failed"; updated?: number; detail?: string };

function statusLabel(status: StageView["status"]) {
  return { pending: "等待中", running: "更新中", success: "完成", partial: "部分完成", failed: "失敗" }[status];
}

export function ManualRefreshPanel({ onCompleted }: { onCompleted: () => void }) {
  if (!trpc.auth?.me?.useQuery || !trpc.dashboard?.manualRefresh?.useMutation) return null;
  const { data: user, isLoading: authLoading } = trpc.auth.me.useQuery();
  const [open, setOpen] = useState(false);
  const [activeStage, setActiveStage] = useState<StageKey | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof trpc.dashboard.manualRefresh.useMutation>>["data"]>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const refresh = trpc.dashboard.manualRefresh.useMutation({
    onSuccess: value => {
      setResult(value);
      setActiveStage(null);
      setErrorMessage(null);
      onCompleted();
    },
    onError: error => {
      setActiveStage(null);
      setErrorMessage(error.message || "手動刷新失敗");
    },
  });

  useEffect(() => {
    if (!refresh.isPending || !activeStage) return;
    const index = stages.findIndex(stage => stage.key === activeStage);
    if (index >= stages.length - 1) return;
    const timer = window.setTimeout(() => setActiveStage(stages[index + 1].key), 12_000);
    return () => window.clearTimeout(timer);
  }, [refresh.isPending, activeStage]);

  const stageViews = useMemo<Record<StageKey, StageView>>(() => {
    if (result?.stages) {
      return Object.fromEntries(stages.map(stage => [stage.key, { status: result.stages[stage.key].status as StageView["status"], updated: result.stages[stage.key].updated }])) as Record<StageKey, StageView>;
    }
    return Object.fromEntries(stages.map(stage => [stage.key, { status: activeStage === stage.key ? "running" : activeStage && stages.findIndex(item => item.key === activeStage) > stages.findIndex(item => item.key === stage.key) ? "success" : "pending" }])) as Record<StageKey, StageView>;
  }, [activeStage, result]);

  if (authLoading || user?.role !== "admin") return null;
  const completedCount = Object.values(stageViews).filter(stage => stage.status === "success" || stage.status === "partial").length;
  const progress = refresh.isPending ? Math.max(8, (completedCount / stages.length) * 100) : result ? 100 : 0;

  return <section className="manual-refresh-panel" aria-label="手動刷新管理介面">
    <div className="manual-refresh-head">
      <div><strong>資料刷新管理</strong><small>管理者可手動執行與每日 Heartbeat 共用的刷新流程</small></div>
      <button type="button" className="manual-refresh-button" disabled={refresh.isPending} onClick={() => { setOpen(true); setResult(undefined); setErrorMessage(null); setActiveStage("funds"); refresh.mutate(); }}>{refresh.isPending ? "刷新執行中…" : "手動刷新"}</button>
    </div>
    {open ? <div className="manual-refresh-status" aria-live="polite">
      <div className="manual-refresh-progress-head"><span>{refresh.isPending ? "正在更新資料" : result ? "刷新完成" : errorMessage ? "刷新失敗" : "尚未執行"}</span><strong>{Math.round(progress)}%</strong></div>
      <div className="manual-refresh-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><span style={{ width: `${progress}%` }} /></div>
      <div className="manual-refresh-stages">{stages.map(stage => { const view = stageViews[stage.key]; return <div className={`manual-refresh-stage ${view.status}`} key={stage.key}><span className="manual-refresh-stage-dot" aria-hidden="true" /><div><strong>{stage.label}</strong><small>{statusLabel(view.status)}{view.updated !== undefined ? ` · ${view.updated} 筆` : ""}</small></div></div>; })}</div>
      {result ? <p className="manual-refresh-summary">結果：基金 {result.fundsUpdated} 檔、RSS {result.newsUpdated} 則、行情 {result.marketUpdated} 項、總經 {result.macroPointsUpdated} 點；{result.errors.length > 0 ? `錯誤 ${result.errors.length} 項。` : "沒有錯誤。"}</p> : null}
      {errorMessage ? <p className="manual-refresh-error">{errorMessage}</p> : null}
      {result?.errors.length ? <details className="manual-refresh-errors"><summary>查看錯誤明細（{result.errors.length}）</summary><ul>{result.errors.slice(0, 8).map(error => <li key={error}>{error}</li>)}</ul></details> : null}
    </div> : null}
  </section>;
}
