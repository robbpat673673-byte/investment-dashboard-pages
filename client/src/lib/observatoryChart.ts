export type DatedMacroPoint = { date: string; [key: string]: unknown };

/**
 * Filters a macro series by calendar days ending on the latest valid point.
 * Trading-day gaps such as weekends are preserved; the range is not a row count.
 */
export function filterMacroHistoryByDays<T extends DatedMacroPoint>(points: T[], days: number): T[] {
  if (points.length === 0 || days <= 0) return [];
  const valid = points.filter(point => !Number.isNaN(Date.parse(`${point.date}T00:00:00Z`)));
  if (valid.length === 0) return [];
  const latestTime = Math.max(...valid.map(point => Date.parse(`${point.date}T00:00:00Z`)));
  const cutoffTime = latestTime - (days - 1) * 24 * 60 * 60 * 1000;
  return valid
    .filter(point => {
      const time = Date.parse(`${point.date}T00:00:00Z`);
      return time >= cutoffTime && time <= latestTime;
    })
    .sort((left, right) => left.date.localeCompare(right.date));
}
