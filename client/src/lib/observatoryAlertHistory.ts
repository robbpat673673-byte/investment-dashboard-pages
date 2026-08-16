import type { ObservatoryAlertDisposition } from "./observatoryAlerts";

export const OBSERVATORY_ALERT_HISTORY_KEY = "investment-dashboard-observatory-alert-history";
export type ObservatoryAlertHistoryRecord = {
  key: string;
  ticker: string;
  name: string;
  percentChange: number | null;
  quoteDate: string | null;
  source: string;
  triggeredAt: string;
};

export function parseAlertHistory(value: string | null): ObservatoryAlertHistoryRecord[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item => {
      if (!item || typeof item !== "object") return false;
      const record = item as Partial<ObservatoryAlertHistoryRecord>;
      return typeof record.key === "string" && typeof record.ticker === "string" && typeof record.name === "string" && typeof record.triggeredAt === "string";
    }).slice(0, 200) as ObservatoryAlertHistoryRecord[];
  } catch {
    return [];
  }
}

export function serializeAlertHistory(records: ObservatoryAlertHistoryRecord[]): string {
  return JSON.stringify(records.slice(0, 200));
}

export function mergeAlertHistory(current: ObservatoryAlertHistoryRecord[], incoming: ObservatoryAlertHistoryRecord[]): ObservatoryAlertHistoryRecord[] {
  const byKey = new Map(current.map(record => [record.key, record]));
  for (const record of incoming) byKey.set(record.key, record);
  return Array.from(byKey.values()).sort((left, right) => right.triggeredAt.localeCompare(left.triggeredAt)).slice(0, 200);
}

export function alertHistoryStatus(record: ObservatoryAlertHistoryRecord, disposition: ObservatoryAlertDisposition): "已讀" | "已忽略" | "未讀" {
  if (disposition.ignored.includes(record.key)) return "已忽略";
  if (disposition.read.includes(record.key)) return "已讀";
  return "未讀";
}
