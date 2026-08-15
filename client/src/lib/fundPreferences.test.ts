import { describe, expect, it } from "vitest";
import { createFavoriteExport, parseFavoriteFundIds, parseFavoriteImport, sortFundsByReturn, toggleFavoriteFundId } from "./fundPreferences";

describe("基金自選與報酬排序工具", () => {
  it("只保留有效且唯一的自選基金識別碼", () => {
    expect(parseFavoriteFundIds("[4, 4, 9, 0, -1, \"7\"]")).toEqual([4, 9]);
    expect(parseFavoriteFundIds("not-json")).toEqual([]);
  });

  it("可加入與移除同一檔自選基金", () => {
    expect(toggleFavoriteFundId([1, 3], 7)).toEqual([1, 3, 7]);
    expect(toggleFavoriteFundId([1, 3, 7], 3)).toEqual([1, 7]);
  });

  it("匯出與匯入自選清單時保留版本、時間與有效基金識別碼", () => {
    const exported = createFavoriteExport([7, 7, 3, 0], "2026-08-15T00:00:00.000Z");
    expect(parseFavoriteImport(exported)).toEqual({ fundIds: [7, 3], exportedAt: "2026-08-15T00:00:00.000Z" });
    expect(parseFavoriteImport('{"version":99,"fundIds":[1]}')).toBeNull();
    expect(parseFavoriteImport("not-json")).toBeNull();
  });

  it("依指定期間升降序排序，且缺少資料的基金維持在最後", () => {
    const funds = [
      { id: 1, perf: { week: 4.2, year: 18, ytd: 12 } },
      { id: 2, perf: { week: null, year: -2, ytd: null } },
      { id: 3, perf: { week: -1.5, year: 30, ytd: 18 } },
    ];
    expect(sortFundsByReturn(funds, "week:desc").map(item => item.id)).toEqual([1, 3, 2]);
    expect(sortFundsByReturn(funds, "year:asc").map(item => item.id)).toEqual([2, 1, 3]);
    expect(sortFundsByReturn(funds, "ytd:desc").map(item => item.id)).toEqual([3, 1, 2]);
  });
});
