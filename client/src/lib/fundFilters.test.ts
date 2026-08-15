import { describe, expect, it } from "vitest";
import { filterFunds } from "./fundFilters";

const funds = [
  { name: "野村台灣運籌基金", code: "NOM006", fundType: "domestic" as const, currency: "TWD" },
  { name: "富邦台美雙星多重資產基金", code: "4603", fundType: "domestic" as const, currency: "TWD" },
  { name: "貝萊德環球資產配置基金", code: "AU07", fundType: "foreign" as const, currency: "USD" },
];

describe("filterFunds", () => {
  it("可依不分大小寫的名稱或代碼搜尋", () => {
    expect(filterFunds(funds, { query: "nom006", scope: "all", currency: "all" }).map(fund => fund.code)).toEqual(["NOM006"]);
    expect(filterFunds(funds, { query: "台美雙星", scope: "all", currency: "all" }).map(fund => fund.code)).toEqual(["4603"]);
  });

  it("可依國內或國際基金類型篩選", () => {
    expect(filterFunds(funds, { query: "", scope: "domestic", currency: "all" })).toHaveLength(2);
    expect(filterFunds(funds, { query: "", scope: "foreign", currency: "all" }).map(fund => fund.code)).toEqual(["AU07"]);
  });

  it("可合併幣別與關鍵字篩選", () => {
    expect(filterFunds(funds, { query: "環球", scope: "all", currency: "USD" }).map(fund => fund.code)).toEqual(["AU07"]);
    expect(filterFunds(funds, { query: "環球", scope: "all", currency: "TWD" })).toEqual([]);
  });
});
