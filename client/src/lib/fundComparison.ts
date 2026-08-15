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
