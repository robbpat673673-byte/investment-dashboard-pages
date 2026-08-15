import { calculatePerformances, type NavPoint } from "./dashboardCalculations";

export type FundDetailInput = {
  id: number;
  name: string;
  code: string | null;
  fundType: "domestic" | "foreign";
  currency: string;
  latestNav: number | null;
  asOfDate: Date | string | null;
  history: NavPoint[];
  lastSyncedAt: Date | string | null;
};

/** 將資料庫基金與完整淨值歷史轉為公開詳細頁使用的穩定資料契約。 */
export function buildPublicFundDetail(input: FundDetailInput) {
  const latestHistory = input.history.at(-1) ?? null;
  const endpoint = input.fundType === "foreign"
    ? "https://fund.hncb.com.tw/w/bcd/BCDNavList.djbcd"
    : "https://fund.hncb.com.tw/w/bcd/tBCDNavList.djbcd";

  return {
    id: input.id,
    name: input.name,
    code: input.code,
    fundType: input.fundType,
    currency: input.currency,
    nav: input.latestNav ?? latestHistory?.nav ?? null,
    asOfDate: input.asOfDate ?? latestHistory?.date ?? null,
    history: input.history,
    perf: calculatePerformances(input.history),
    source: {
      name: "MoneyDJ／合庫基金圖表資料",
      detail: input.fundType === "foreign" ? "合庫基金境外基金圖表端點" : "合庫基金國內基金圖表端點",
      url: "https://fund.hncb.com.tw/",
      endpoint,
      lastSyncedAt: input.lastSyncedAt,
    },
  };
}
