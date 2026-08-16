export const OBSERVATORY_ALERTS_KEY = "observatory-alert-preferences";
export const OBSERVATORY_ALERT_STATE_KEY = "observatory-alert-state";

export type ObservatoryAlertDisposition = { read: string[]; ignored: string[] };

export const DEFAULT_ALERT_DISPOSITION: ObservatoryAlertDisposition = { read: [], ignored: [] };

export function alertDispositionKey(alert: Pick<AlertQuote, "ticker" | "percentChange"> & { quoteDate?: string | null }) {
  return `${alert.ticker}:${alert.quoteDate ?? "unknown"}:${alert.percentChange ?? "na"}`;
}

export function parseAlertDisposition(raw: string | null): ObservatoryAlertDisposition {
  if (!raw) return DEFAULT_ALERT_DISPOSITION;
  try {
    const parsed = JSON.parse(raw) as Partial<ObservatoryAlertDisposition>;
    return {
      read: Array.isArray(parsed.read) ? parsed.read.filter((item): item is string => typeof item === "string").slice(-100) : [],
      ignored: Array.isArray(parsed.ignored) ? parsed.ignored.filter((item): item is string => typeof item === "string").slice(-100) : [],
    };
  } catch {
    return DEFAULT_ALERT_DISPOSITION;
  }
}

export function serializeAlertDisposition(value: ObservatoryAlertDisposition) {
  return JSON.stringify({ read: value.read.slice(-100), ignored: value.ignored.slice(-100) });
}

export type ObservatoryAlertPreferences = {
  enabled: boolean;
  marketThreshold: number;
  macroThreshold: number;
};

export type AlertQuote = {
  ticker: string;
  name: string;
  percentChange: number | null;
  quoteDate?: string | null;
};

export const DEFAULT_ALERT_PREFERENCES: ObservatoryAlertPreferences = {
  enabled: false,
  marketThreshold: 2,
  macroThreshold: 1,
};

export function parseAlertPreferences(raw: string | null): ObservatoryAlertPreferences {
  if (!raw) return DEFAULT_ALERT_PREFERENCES;
  try {
    const parsed = JSON.parse(raw) as Partial<ObservatoryAlertPreferences>;
    return {
      enabled: parsed.enabled === true,
      marketThreshold: Number.isFinite(parsed.marketThreshold) ? Math.min(Math.max(Number(parsed.marketThreshold), 0.1), 20) : DEFAULT_ALERT_PREFERENCES.marketThreshold,
      macroThreshold: Number.isFinite(parsed.macroThreshold) ? Math.min(Math.max(Number(parsed.macroThreshold), 0.1), 10) : DEFAULT_ALERT_PREFERENCES.macroThreshold,
    };
  } catch {
    return DEFAULT_ALERT_PREFERENCES;
  }
}

export function serializeAlertPreferences(preferences: ObservatoryAlertPreferences): string {
  return JSON.stringify(preferences);
}

export function findTriggeredAlerts(quotes: AlertQuote[], preferences: ObservatoryAlertPreferences) {
  if (!preferences.enabled) return [];
  return quotes.filter(quote => {
    if (quote.percentChange === null) return false;
    const threshold = ["TWD=X", "DX-Y.NYB", "^IRX", "^TNX", "^TYX"].includes(quote.ticker)
      ? preferences.macroThreshold
      : preferences.marketThreshold;
    return Math.abs(quote.percentChange) >= threshold;
  });
}

export type NotificationEnvironment = { Notification?: { permission: string; requestPermission: () => Promise<NotificationPermission> } };

export function notificationSupported(environment: NotificationEnvironment = globalThis as NotificationEnvironment) {
  return typeof environment.Notification !== "undefined";
}

export async function requestObservatoryNotification(environment: NotificationEnvironment = globalThis as NotificationEnvironment) {
  if (!notificationSupported(environment)) return { permission: "unsupported" as const, message: "此瀏覽器不支援通知。" };
  const permission = await environment.Notification!.requestPermission();
  return permission === "granted"
    ? { permission, message: "通知已啟用；下一次資料刷新符合門檻時會提醒。" }
    : { permission, message: "通知權限未開啟，請在瀏覽器設定中允許此網站通知。" };
}
