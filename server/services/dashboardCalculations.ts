export type NavPoint = { date: string; nav: number };

const PERIODS = [
  ["week", "days", 7],
  ["month", "months", 1],
  ["quarter", "months", 3],
  ["halfYear", "months", 6],
  ["year", "months", 12],
] as const;

export type PerformanceValues = Record<(typeof PERIODS)[number][0], number | null>;

export function parseHistoryPayload(payload: string): NavPoint[] {
  const parts = payload.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return [];
  const days = parts[0].split(",");
  const navs = parts[1].split(",");
  const points = new Map<string, number>();

  for (let index = 0; index < Math.min(days.length, navs.length); index += 1) {
    const rawDay = days[index]?.trim();
    const nav = Number(navs[index]?.replace(/,/g, ""));
    if (!rawDay || !/^\d{8}$/.test(rawDay) || !Number.isFinite(nav) || nav <= 0) continue;
    const date = `${rawDay.slice(0, 4)}-${rawDay.slice(4, 6)}-${rawDay.slice(6, 8)}`;
    points.set(date, nav);
  }

  return Array.from(points.entries())
    .map(([date, nav]) => ({ date, nav }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

export function shiftMonths(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const anchor = new Date(Date.UTC(year, month - 1 - months, 1));
  const endOfTargetMonth = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0)).getUTCDate();
  const shifted = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), Math.min(day, endOfTargetMonth)));
  return shifted.toISOString().slice(0, 10);
}

function subtractDays(isoDate: string, days: number): string {
  const target = new Date(`${isoDate}T00:00:00.000Z`);
  target.setUTCDate(target.getUTCDate() - days);
  return target.toISOString().slice(0, 10);
}

function navOnOrBefore(history: NavPoint[], targetDate: string): NavPoint | null {
  let candidate: NavPoint | null = null;
  for (const point of history) {
    if (point.date > targetDate) break;
    candidate = point;
  }
  return candidate;
}

export function calculatePerformances(history: NavPoint[]): PerformanceValues {
  const result: PerformanceValues = { week: null, month: null, quarter: null, halfYear: null, year: null };
  if (history.length < 2) return result;

  const latest = history[history.length - 1];
  for (const [key, kind, amount] of PERIODS) {
    const target = kind === "days" ? subtractDays(latest.date, amount) : shiftMonths(latest.date, amount);
    const baseline = navOnOrBefore(history, target);
    if (baseline && baseline.nav > 0) {
      result[key] = Number((((latest.nav / baseline.nav) - 1) * 100).toFixed(4));
    }
  }
  return result;
}

export function cleanText(value: string, limit = 180): string {
  const decoded = value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return decoded.length > limit ? `${decoded.slice(0, limit).trimEnd()}…` : decoded;
}

export function safeUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}
