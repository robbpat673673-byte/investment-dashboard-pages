import { calculatePerformances, type NavPoint } from "./dashboardCalculations";

export type FundDetailInput = {
  id: number;
  name: string;
  code: string | null;
  fundType: "domestic" | "foreign";
  currency: string;
  isin?: string | null;
  bankCode?: string | null;
  latestNav: number | null;
  asOfDate: Date | string | null;
  history: NavPoint[];
  distributions?: Array<{ exDate: string; amount: number; annualizedYield: number | null; payoutDate: string | null; sourceUrl: string }>;
  benchmarkHistory?: NavPoint[];
  lastSyncedAt: Date | string | null;
};

function buildReinvestedHistory(history: NavPoint[], distributions: NonNullable<FundDetailInput["distributions"]>) {
  if (history.length === 0) return [];
  const dividendsByDate = new Map<string, number>();
  for (const item of distributions) dividendsByDate.set(item.exDate, (dividendsByDate.get(item.exDate) ?? 0) + item.amount);
  let indexedValue = 100;
  return history.map((point, index) => {
    if (index > 0) {
      const previous = history[index - 1];
      const dividend = dividendsByDate.get(point.date) ?? 0;
      indexedValue *= (point.nav + dividend) / previous.nav;
    }
    return { date: point.date, nav: Number(indexedValue.toFixed(6)) };
  });
}

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
    isin: input.isin ?? null,
    bankCode: input.bankCode ?? null,
    fundType: input.fundType,
    currency: input.currency,
    nav: input.latestNav ?? latestHistory?.nav ?? null,
    asOfDate: input.asOfDate ?? latestHistory?.date ?? null,
    history: input.history,
    perf: calculatePerformances(input.history),
    totalReturn: input.fundType === "domestic"
      ? { available: true, history: buildReinvestedHistory(input.history, input.distributions ?? []), method: "配息於除息日淨值再投入" }
      : { available: false, history: [] as NavPoint[], method: "目前公開來源未提供完整配息歷史" },
    distributions: input.distributions ?? [],
    benchmark: {
      ticker: "^GSPC",
      name: "S&P 500",
      history: input.benchmarkHistory ?? [],
      method: "價格指數；同期間首日正規化為 100",
    },
    source: {
      name: "MoneyDJ／合庫基金圖表資料",
      detail: input.fundType === "foreign" ? "合庫基金境外基金圖表端點" : "合庫基金國內基金圖表端點",
      url: "https://fund.hncb.com.tw/",
      endpoint,
      lastSyncedAt: input.lastSyncedAt,
    },
  };
}
