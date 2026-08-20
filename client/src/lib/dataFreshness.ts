export type DataFreshnessKind = "latest" | "previous-trading-day" | "delayed" | "foreign-lag" | "missing";

export type DataFreshness = {
  kind: DataFreshnessKind;
  label: string;
  detail: string;
};

function parseDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const text = String(value);
  const match = text.match(/^(\d{4})[-/]?(\d{2})[-/]?(\d{2})$/);
  if (match) return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function dayAge(asOfDate: Date, now: Date) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.floor((today - asOfDate.getTime()) / 86_400_000));
}

export function classifyDataFreshness(asOf: Date | string | null | undefined, now = new Date(), type: "market" | "domestic-fund" | "foreign-fund" | "macro" = "market"): DataFreshness {
  const shortDate = typeof asOf === "string" ? asOf.match(/^(\d{2})\/(\d{2})$/) : null;
  const parsed = shortDate
    ? new Date(Date.UTC(now.getUTCFullYear(), Number(shortDate[1]) - 1, Number(shortDate[2])))
    : parseDate(asOf);
  if (!parsed) return { kind: "missing", label: "無資料日期", detail: "來源尚未提供可辨識的資料截至日" };
  const age = dayAge(parsed, now);
  if (age === 0) return { kind: "latest", label: "今日資料", detail: "資料截至今日" };
  if (type === "foreign-fund" && age <= 3) return { kind: "foreign-lag", label: "境外公布落後", detail: `資料截至 ${age} 天前；境外基金淨值通常依海外公布日更新` };
  if (age === 1 || (type === "market" || type === "macro") && age <= 2) return { kind: "previous-trading-day", label: "前一交易日", detail: `資料截至 ${age} 天前，可能是最近一個已完成交易日` };
  return { kind: "delayed", label: "資料延遲", detail: `資料截至 ${age} 天前，已超過預期更新時間` };
}

export function formatAsOfDate(value: Date | string | null | undefined) {
  const parsed = parseDate(value);
  if (!parsed) return "--";
  return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(parsed);
}
