import { describe, expect, it } from "vitest";
import { filterFunds } from "./fundFilters";

const funds = [
  { name: "野村台灣運籌基金", code: "NOM006", isin: null, bankCode: "001001", fundType: "domestic" as const, currency: "TWD" },
  { name: "富邦台美雙星多重資產基金", code: "4603", isin: null, bankCode: "ACFP143", fundType: "domestic" as const, currency: "TWD" },
  { name: "安聯台灣科技基金", code: "ALI006", isin: "TW000T3604Y3", bankCode: "005003", fundType: "domestic" as const, currency: "TWD" },
  { name: "貝萊德環球資產配置基金", code: "AU07", isin: null, bankCode: "SHZY14", fundType: "foreign" as const, currency: "USD" },
];

describe("filterFunds", () => {
  it("可依不分大小寫的名稱或代碼搜尋", () => {
    expect(filterFunds(funds, { query: "nom006", scope: "all", currency: "all" }).map(fund => fund.code)).toEqual(["NOM006"]);
    expect(filterFunds(funds, { query: "台美雙星", scope: "all", currency: "all" }).map(fund => fund.code)).toEqual(["4603"]);
  });

  it("可依 ISIN、銀行／通路代號與忽略連字號的文字模糊搜尋", () => {
    expect(filterFunds(funds, { query: "tw000-t3604y3", scope: "all", currency: "all" }).map(fund => fund.code)).toEqual(["ALI006"]);
    expect(filterFunds(funds, { query: "shzy14", scope: "all", currency: "all" }).map(fund => fund.code)).toEqual(["AU07"]);
  });

  it("可依國內或國際基金類型篩選", () => {
    expect(filterFunds(funds, { query: "", scope: "domestic", currency: "all" })).toHaveLength(3);
    expect(filterFunds(funds, { query: "", scope: "foreign", currency: "all" }).map(fund => fund.code)).toEqual(["AU07"]);
  });

  it("可合併幣別與關鍵字篩選", () => {
    expect(filterFunds(funds, { query: "環球", scope: "all", currency: "USD" }).map(fund => fund.code)).toEqual(["AU07"]);
    expect(filterFunds(funds, { query: "環球", scope: "all", currency: "TWD" })).toEqual([]);
  });
});
