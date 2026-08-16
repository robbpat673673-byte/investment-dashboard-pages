import { describe, expect, it } from "vitest";
import { DEFAULT_ALERT_DISPOSITION, DEFAULT_ALERT_PREFERENCES, alertDispositionKey, findTriggeredAlerts, parseAlertDisposition, parseAlertPreferences, requestObservatoryNotification, serializeAlertDisposition, serializeAlertPreferences } from "./observatoryAlerts";

describe("observatory alert preferences", () => {
  it("parses and serializes bounded preferences", () => {
    const parsed = parseAlertPreferences('{"enabled":true,"marketThreshold":4,"macroThreshold":1.5}');
    expect(parsed).toEqual({ enabled: true, marketThreshold: 4, macroThreshold: 1.5 });
    expect(parseAlertPreferences(serializeAlertPreferences(parsed))).toEqual(parsed);
  });

  it("falls back safely for malformed preferences", () => {
    expect(parseAlertPreferences("not-json")).toEqual(DEFAULT_ALERT_PREFERENCES);
    expect(parseAlertPreferences('{"enabled":true,"marketThreshold":99}').marketThreshold).toBe(20);
  });

  it("uses separate market and macro thresholds", () => {
    const triggered = findTriggeredAlerts([
      { ticker: "^TNX", name: "美國 10 年期公債殖利率", percentChange: 1.2 },
      { ticker: "^GSPC", name: "S&P 500", percentChange: 1.9 },
      { ticker: "^DJI", name: "道瓊指數", percentChange: -2.1 },
    ], { enabled: true, marketThreshold: 2, macroThreshold: 1 });
    expect(triggered.map(item => item.ticker)).toEqual(["^TNX", "^DJI"]);
  });

  it("handles granted, denied, and unsupported notification permissions", async () => {
    const granted = await requestObservatoryNotification({ Notification: { permission: "default", requestPermission: async () => "granted" } });
    expect(granted).toEqual({ permission: "granted", message: "通知已啟用；下一次資料刷新符合門檻時會提醒。" });
    const denied = await requestObservatoryNotification({ Notification: { permission: "default", requestPermission: async () => "denied" } });
    expect(denied.permission).toBe("denied");
    expect(denied.message).toContain("通知權限未開啟");
    const unsupported = await requestObservatoryNotification({});
    expect(unsupported).toEqual({ permission: "unsupported", message: "此瀏覽器不支援通知。" });
  });

  it("round trips alert read and ignored state with a stable dated key", () => {
    const key = alertDispositionKey({ ticker: "^TNX", percentChange: 1.2, quoteDate: "2026-08-16" });
    const state = { read: [key], ignored: ["TWD=X:2026-08-15:-0.3"] };
    expect(parseAlertDisposition(serializeAlertDisposition(state))).toEqual(state);
    expect(parseAlertDisposition("bad-json")).toEqual(DEFAULT_ALERT_DISPOSITION);
    expect(alertDispositionKey({ ticker: "^TNX", percentChange: 1.2, quoteDate: "2026-08-17" })).not.toBe(key);
  });

  it("does not alert while disabled or when quote data is unavailable", () => {
    expect(findTriggeredAlerts([{ ticker: "^DJI", name: "道瓊指數", percentChange: 5 }], { ...DEFAULT_ALERT_PREFERENCES, enabled: false })).toEqual([]);
    expect(findTriggeredAlerts([{ ticker: "^DJI", name: "道瓊指數", percentChange: null }], { ...DEFAULT_ALERT_PREFERENCES, enabled: true })).toEqual([]);
  });
});
