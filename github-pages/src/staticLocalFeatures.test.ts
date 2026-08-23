// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { StaticFund } from "./staticDashboard";
import { addFavoriteGroup, evaluateFundAlerts, readFavoriteGroups, readFundAlerts, renameFavoriteGroup, STATIC_ALERTS_KEY, STATIC_GROUPS_KEY, toggleFundInGroup } from "./staticLocalFeatures";

const fund = { id: "fund-1", name: "示範基金", nav: 10.25 } as StaticFund;

describe("靜態版本機警示與自選群組", () => {
  it("會拒絕不完整本機資料，並讀取合法規則", () => {
    localStorage.setItem(STATIC_ALERTS_KEY, "not-json");
    localStorage.setItem(STATIC_GROUPS_KEY, JSON.stringify([{ id: "group-1", name: " 核心持股 ", fundIds: ["fund-1", "fund-1"], createdAt: "2026-08-23T00:00:00.000Z" }]));

    expect(readFundAlerts(localStorage)).toEqual([]);
    expect(readFavoriteGroups(localStorage)).toEqual([{ id: "group-1", name: "核心持股", fundIds: ["fund-1"], createdAt: "2026-08-23T00:00:00.000Z" }]);
  });

  it("可建立、重新命名群組並切換基金歸屬", () => {
    const first = addFavoriteGroup([], "核心持股", "group-1", "2026-08-23T00:00:00.000Z");
    const duplicated = addFavoriteGroup(first, "核心持股", "group-2", "2026-08-23T00:00:00.000Z");
    const assigned = toggleFundInGroup(first, "group-1", "fund-1");
    const renamed = renameFavoriteGroup(assigned, "group-1", "長期配置");

    expect(duplicated).toHaveLength(1);
    expect(renamed[0]).toMatchObject({ name: "長期配置", fundIds: ["fund-1"] });
    expect(toggleFundInGroup(renamed, "group-1", "fund-1")[0].fundIds).toEqual([]);
  });

  it("只在啟用規則與淨值條件皆符合時產生提醒", () => {
    const alerts = [
      { id: "up", fundId: "fund-1", direction: "atOrAbove" as const, threshold: 10, enabled: true, createdAt: "2026-08-23T00:00:00.000Z" },
      { id: "down", fundId: "fund-1", direction: "atOrBelow" as const, threshold: 10, enabled: true, createdAt: "2026-08-23T00:00:00.000Z" },
      { id: "off", fundId: "fund-1", direction: "atOrAbove" as const, threshold: 1, enabled: false, createdAt: "2026-08-23T00:00:00.000Z" },
    ];

    expect(evaluateFundAlerts([fund], alerts).map(item => item.alert.id)).toEqual(["up"]);
  });
});
