import { describe, expect, it } from "vitest";
import { DEFAULT_ALERT_DISPOSITION } from "./observatoryAlerts";
import { alertHistoryStatus, mergeAlertHistory, parseAlertHistory, serializeAlertHistory, type ObservatoryAlertHistoryRecord } from "./observatoryAlertHistory";

const first: ObservatoryAlertHistoryRecord = { key: "^TNX:2026-08-16:1.19", ticker: "^TNX", name: "美國 10 年期公債殖利率", percentChange: 1.19, quoteDate: "2026-08-16", source: "市場行情", triggeredAt: "2026-08-16T05:00:00.000Z" };
const second: ObservatoryAlertHistoryRecord = { ...first, key: "TWD=X:2026-08-15:-0.3", ticker: "TWD=X", name: "美元兌台幣", percentChange: -0.3, quoteDate: "2026-08-15", triggeredAt: "2026-08-16T04:00:00.000Z" };

describe("observatory alert history", () => {
  it("parses, serializes, merges and sorts records by trigger time", () => {
    expect(parseAlertHistory(serializeAlertHistory([second, first]))).toEqual([second, first]);
    expect(mergeAlertHistory([second], [first, { ...second, triggeredAt: "2026-08-16T06:00:00.000Z" }]).map(item => item.key)).toEqual(["TWD=X:2026-08-15:-0.3", "^TNX:2026-08-16:1.19"]);
    expect(parseAlertHistory('[{"bad":true}]')).toEqual([]);
  });

  it("derives unread, read and ignored status", () => {
    expect(alertHistoryStatus(first, DEFAULT_ALERT_DISPOSITION)).toBe("未讀");
    expect(alertHistoryStatus(first, { read: [first.key], ignored: [] })).toBe("已讀");
    expect(alertHistoryStatus(first, { read: [], ignored: [first.key] })).toBe("已忽略");
  });
});
