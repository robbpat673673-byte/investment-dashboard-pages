export const FAVORITE_FUNDS_STORAGE_KEY = "investment-dashboard-favorite-funds";

export const returnPeriodKeys = ["week", "month", "quarter", "halfYear", "year"] as const;
export type ReturnPeriodKey = (typeof returnPeriodKeys)[number];
export type FundSortKey = "default" | `${ReturnPeriodKey}:desc` | `${ReturnPeriodKey}:asc`;

export type ReturnSortableFund = {
  id: number;
  perf: Partial<Record<ReturnPeriodKey, number | null>>;
};

export function parseFavoriteFundIds(value: string | null): number[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.filter((item): item is number => Number.isInteger(item) && item > 0)));
  } catch {
    return [];
  }
}

export function toggleFavoriteFundId(ids: number[], id: number): number[] {
  return ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id];
}

export function sortFundsByReturn<T extends ReturnSortableFund>(funds: T[], sortKey: FundSortKey): T[] {
  if (sortKey === "default") return [...funds];
  const [period, direction] = sortKey.split(":") as [ReturnPeriodKey, "asc" | "desc"];
  return [...funds].sort((left, right) => {
    const leftValue = left.perf[period];
    const rightValue = right.perf[period];
    const leftMissing = leftValue === null || leftValue === undefined;
    const rightMissing = rightValue === null || rightValue === undefined;
    if (leftMissing && rightMissing) return 0;
    if (leftMissing) return 1;
    if (rightMissing) return -1;
    return direction === "desc" ? rightValue - leftValue : leftValue - rightValue;
  });
}
