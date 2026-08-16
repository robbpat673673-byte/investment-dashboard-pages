export const OBSERVATORY_ALERTS_KEY = "observatory-alert-preferences";

export type ObservatoryAlertPreferences = {
  enabled: boolean;
  marketThreshold: number;
  macroThreshold: number;
};

export type AlertQuote = {
  ticker: string;
  name: string;
  percentChange: number | null;
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
