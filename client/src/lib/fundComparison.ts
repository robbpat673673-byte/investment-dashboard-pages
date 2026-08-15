export type NavHistoryPoint = { date: string; nav: number };

export type ComparisonPoint = { x: number; value: number };

export type FundComparisonSeries = {
  startDate: string;
  endDate: string;
  primary: ComparisonPoint[];
  secondary: ComparisonPoint[];
  min: number;
  max: number;
};

export type ComparisonLine = { key: string; label: string; history: NavHistoryPoint[] };
export type MultiComparisonSeries = { startDate: string; endDate: string; lines: Array<{ key: string; label: string; points: ComparisonPoint[] }>; min: number; max: number };

export function sliceHistoryByMonths(history: NavHistoryPoint[], months: number | null): NavHistoryPoint[] {
  if (!months || history.length === 0) return history;
  const latest = new Date(`${history.at(-1)!.date}T00:00:00.000Z`);
  latest.setUTCMonth(latest.getUTCMonth() - months);
  return history.filter(point => new Date(`${point.date}T00:00:00.000Z`).getTime() >= latest.getTime());
}

/** 將任意多條序列裁切至共同期間，並各自以共同區間的第一筆可用資料正規化為 100。 */
export function buildMultiComparisonSeries(lines: ComparisonLine[]): MultiComparisonSeries | null {
  const usable = lines.filter(line => line.history.length >= 2);
  if (usable.length < 2) return null;
  const start = Math.max(...usable.map(line => new Date(`${line.history[0]!.date}T00:00:00.000Z`).getTime()));
  const end = Math.min(...usable.map(line => new Date(`${line.history.at(-1)!.date}T00:00:00.000Z`).getTime()));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const span = end - start;
  const normalizedLines = usable.map(line => {
    const points = line.history.filter(point => {
      const timestamp = new Date(`${point.date}T00:00:00.000Z`).getTime();
      return timestamp >= start && timestamp <= end;
    });
    if (points.length < 2) return null;
    const base = points[0]!.nav || 1;
    return { key: line.key, label: line.label, points: points.map(point => ({ x: ((new Date(`${point.date}T00:00:00.000Z`).getTime() - start) / span) * 100, value: (point.nav / base) * 100 })) };
  }).filter((line): line is { key: string; label: string; points: ComparisonPoint[] } => line !== null);
  if (normalizedLines.length < 2) return null;
  const values = normalizedLines.flatMap(line => line.points.map(point => point.value));
  return { startDate: new Date(start).toISOString().slice(0, 10), endDate: new Date(end).toISOString().slice(0, 10), lines: normalizedLines, min: Math.min(...values), max: Math.max(...values) };
}

/** 取兩檔基金的可重疊歷史區間，將各自首筆可用淨值正規化為 100。 */
export function buildFundComparisonSeries(primaryHistory: NavHistoryPoint[], secondaryHistory: NavHistoryPoint[]): FundComparisonSeries | null {
  if (primaryHistory.length < 2 || secondaryHistory.length < 2) return null;
  const primaryStart = new Date(primaryHistory[0].date).getTime();
  const secondaryStart = new Date(secondaryHistory[0].date).getTime();
  const overlapStart = Math.max(primaryStart, secondaryStart);
  const primary = primaryHistory.filter(point => new Date(point.date).getTime() >= overlapStart);
  const secondary = secondaryHistory.filter(point => new Date(point.date).getTime() >= overlapStart);
  if (primary.length < 2 || secondary.length < 2 || !Number.isFinite(overlapStart)) return null;
  const end = Math.max(new Date(primary.at(-1)!.date).getTime(), new Date(secondary.at(-1)!.date).getTime());
  const span = end - overlapStart || 1;
  const scale = (points: NavHistoryPoint[]) => {
    const base = points[0]!.nav || 1;
    return points.map(point => ({ x: ((new Date(point.date).getTime() - overlapStart) / span) * 100, value: (point.nav / base) * 100 }));
  };
  const scaledPrimary = scale(primary);
  const scaledSecondary = scale(secondary);
  const values = [...scaledPrimary, ...scaledSecondary].map(point => point.value);
  return { startDate: primary[0]!.date, endDate: primary.at(-1)!.date, primary: scaledPrimary, secondary: scaledSecondary, min: Math.min(...values), max: Math.max(...values) };
}
