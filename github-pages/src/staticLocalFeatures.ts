import type { StaticFund } from "./staticDashboard";

export const STATIC_ALERTS_KEY = "static-dashboard:fund-alerts";
export const STATIC_GROUPS_KEY = "static-dashboard:favorite-groups";

export type FundAlertDirection = "atOrAbove" | "atOrBelow";
export type FundAlert = {
  id: string;
  fundId: string;
  direction: FundAlertDirection;
  threshold: number;
  enabled: boolean;
  createdAt: string;
};

export type FavoriteGroup = {
  id: string;
  name: string;
  fundIds: string[];
  createdAt: string;
};

function readJson(storage: Storage, key: string): unknown {
  try {
    return JSON.parse(storage.getItem(key) || "null");
  } catch {
    return null;
  }
}

export function readFundAlerts(storage: Storage): FundAlert[] {
  const value = readJson(storage, STATIC_ALERTS_KEY);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is FundAlert => Boolean(
    item && typeof item === "object" && typeof item.id === "string" && typeof item.fundId === "string"
      && (item.direction === "atOrAbove" || item.direction === "atOrBelow")
      && typeof item.threshold === "number" && Number.isFinite(item.threshold)
      && typeof item.enabled === "boolean" && typeof item.createdAt === "string",
  ));
}

export function readFavoriteGroups(storage: Storage): FavoriteGroup[] {
  const value = readJson(storage, STATIC_GROUPS_KEY);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is FavoriteGroup => Boolean(
    item && typeof item === "object" && typeof item.id === "string" && typeof item.name === "string"
      && Array.isArray(item.fundIds) && item.fundIds.every((fundId: unknown) => typeof fundId === "string")
      && typeof item.createdAt === "string",
  )).map(group => ({ ...group, name: group.name.trim(), fundIds: Array.from(new Set(group.fundIds)) })).filter(group => group.name.length > 0);
}

export function addFavoriteGroup(groups: FavoriteGroup[], name: string, id: string, createdAt: string): FavoriteGroup[] {
  const cleanName = name.trim().slice(0, 30);
  if (!cleanName || groups.some(group => group.name.localeCompare(cleanName, "zh-Hant", { sensitivity: "accent" }) === 0)) return groups;
  return [...groups, { id, name: cleanName, fundIds: [], createdAt }];
}

export function renameFavoriteGroup(groups: FavoriteGroup[], groupId: string, name: string): FavoriteGroup[] {
  const cleanName = name.trim().slice(0, 30);
  if (!cleanName || groups.some(group => group.id !== groupId && group.name.localeCompare(cleanName, "zh-Hant", { sensitivity: "accent" }) === 0)) return groups;
  return groups.map(group => group.id === groupId ? { ...group, name: cleanName } : group);
}

export function toggleFundInGroup(groups: FavoriteGroup[], groupId: string, fundId: string): FavoriteGroup[] {
  return groups.map(group => group.id !== groupId ? group : {
    ...group,
    fundIds: group.fundIds.includes(fundId) ? group.fundIds.filter(id => id !== fundId) : [...group.fundIds, fundId],
  });
}

export function evaluateFundAlerts(funds: StaticFund[], alerts: FundAlert[]) {
  const fundById = new Map(funds.map(fund => [fund.id, fund]));
  return alerts.flatMap(alert => {
    const fund = fundById.get(alert.fundId);
    const triggered = alert.enabled && fund && (alert.direction === "atOrAbove" ? fund.nav >= alert.threshold : fund.nav <= alert.threshold);
    return triggered ? [{ alert, fund }] : [];
  });
}
