export const HISTORY_RANGE_KEY = "investment-dashboard-history-range";
export const historyRanges = ["1M", "3M", "6M", "1Y"] as const;
export type HistoryRange = (typeof historyRanges)[number];

export const historyRangeLabels: Record<HistoryRange, string> = { "1M": "1 個月", "3M": "3 個月", "6M": "6 個月", "1Y": "1 年" };
const rangeDays: Record<HistoryRange, number> = { "1M": 31, "3M": 92, "6M": 184, "1Y": 366 };

export function parseHistoryRange(value: string | null | undefined): HistoryRange {
  return value && historyRanges.includes(value as HistoryRange) ? value as HistoryRange : "1Y";
}

export function sliceHistoryByRange<T extends { date: string }>(history: T[], range: HistoryRange): T[] {
  if (history.length < 2) return history;
  const sorted = [...history].sort((left, right) => left.date.localeCompare(right.date));
  const latest = new Date(`${sorted[sorted.length - 1].date}T00:00:00Z`);
  if (Number.isNaN(latest.getTime())) return sorted;
  const start = new Date(latest);
  start.setUTCDate(start.getUTCDate() - rangeDays[range]);
  return sorted.filter(point => {
    const date = new Date(`${point.date}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date >= start && date <= latest;
  });
}
