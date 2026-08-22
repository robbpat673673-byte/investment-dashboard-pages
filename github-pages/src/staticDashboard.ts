export type StaticPoint = { date: string; value: number };
export type StaticMarket = { ticker: string; name: string; price: number; change: number; percentChange: number; quoteDate: string; history: StaticPoint[] };
export type StaticFund = { id: string; type: "domestic" | "foreign"; name: string; code: string | null; currency: string; asOfDate: string; nav: number; returns: Record<string, number | null>; history: StaticPoint[] };
export type StaticNews = { title: string; summary: string; url: string; source: string; publishedAt: string };
export type StaticSourceHealth = { source: string; status: string; acceptedCount: number; latencyMs?: number; detail?: string };
export type StaticDashboard = { generatedAt: string | null; markets: StaticMarket[]; funds: StaticFund[]; news: StaticNews[]; sourceHealth: StaticSourceHealth[]; errors: string[] };

export function staticDashboardUrl(basePath = import.meta.env.BASE_URL) {
  return `${basePath.endsWith("/") ? basePath : `${basePath}/`}data/dashboard.json`;
}

export function isStaticDashboard(value: unknown): value is StaticDashboard {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<StaticDashboard>;
  return Array.isArray(input.markets) && Array.isArray(input.funds) && Array.isArray(input.news) && Array.isArray(input.sourceHealth) && Array.isArray(input.errors);
}

export type HistoryRange = "1m" | "3m" | "6m" | "1y";

export function filterHistoryRange(points: StaticPoint[], range: HistoryRange) {
  const latest = points.at(-1)?.date;
  if (!latest) return points;
  const days = { "1m": 31, "3m": 92, "6m": 184, "1y": 366 }[range];
  const threshold = new Date(Date.parse(`${latest}T00:00:00Z`) - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return points.filter(point => point.date >= threshold);
}

export function sortStaticFunds(funds: StaticFund[], key: "name" | "year" | "month") {
  return [...funds].sort((left, right) => key === "name"
    ? left.name.localeCompare(right.name, "zh-Hant")
    : (right.returns[key] ?? Number.NEGATIVE_INFINITY) - (left.returns[key] ?? Number.NEGATIVE_INFINITY));
}
