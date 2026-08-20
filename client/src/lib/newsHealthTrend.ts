export type NewsHealthTrendPoint = {
  refreshRunId: number | null;
  source: string;
  status: "fresh" | "stale" | "empty" | "error";
  acceptedCount: number;
  latencyMs: number | null;
  recordedAt: Date | string;
};

export type NewsHealthChartRow = Record<string, string | number | null> & { label: string };

export function filterNewsHealthSources(sources: string[], selectedSource: string) {
  return selectedSource === "all" ? sources : sources.filter(source => source === selectedSource);
}

export function buildNewsHealthTrend(history: NewsHealthTrendPoint[]) {
  const rows = [...history].sort((left, right) => new Date(left.recordedAt).getTime() - new Date(right.recordedAt).getTime());
  const sources = Array.from(new Set(rows.map(row => row.source)));
  const batches = Array.from(rows.reduce((map, row) => {
    const key = row.refreshRunId === null ? `recorded:${new Date(row.recordedAt).toISOString()}` : `run:${row.refreshRunId}`;
    const batch = map.get(key) ?? { key, recordedAt: new Date(row.recordedAt), rows: [] as NewsHealthTrendPoint[] };
    batch.rows.push(row);
    if (new Date(row.recordedAt).getTime() < batch.recordedAt.getTime()) batch.recordedAt = new Date(row.recordedAt);
    map.set(key, batch);
    return map;
  }, new Map<string, { key: string; recordedAt: Date; rows: NewsHealthTrendPoint[] }>()).values()).sort((left, right) => left.recordedAt.getTime() - right.recordedAt.getTime());

  const successData: NewsHealthChartRow[] = batches.map((batch, batchIndex) => {
    const point: NewsHealthChartRow = { label: batch.recordedAt.toISOString() };
    for (const source of sources) {
      const seen = batches.slice(0, batchIndex + 1).flatMap(item => item.rows.filter(row => row.source === source));
      point[source] = seen.length === 0 ? null : Number(((seen.filter(row => row.status === "fresh").length / seen.length) * 100).toFixed(1));
    }
    return point;
  });
  const latencyData: NewsHealthChartRow[] = batches.map(batch => {
    const point: NewsHealthChartRow = { label: batch.recordedAt.toISOString() };
    for (const source of sources) point[source] = batch.rows.find(row => row.source === source)?.latencyMs ?? null;
    return point;
  });
  return { sources, successData, latencyData, batchCount: batches.length };
}
