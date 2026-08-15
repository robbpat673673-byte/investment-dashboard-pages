export type FundScope = "all" | "domestic" | "foreign";

export type FilterableFund = {
  name: string;
  code: string | null;
  fundType: "domestic" | "foreign";
  currency: string;
};

export type FundFilters = {
  query: string;
  scope: FundScope;
  currency: string;
};

export function filterFunds<T extends FilterableFund>(funds: T[], filters: FundFilters): T[] {
  const keyword = filters.query.trim().toLocaleLowerCase("zh-TW");
  return funds.filter(fund => {
    const matchesScope = filters.scope === "all" || fund.fundType === filters.scope;
    const matchesCurrency = filters.currency === "all" || fund.currency === filters.currency;
    const haystack = `${fund.name} ${fund.code ?? ""}`.toLocaleLowerCase("zh-TW");
    const matchesKeyword = !keyword || haystack.includes(keyword);
    return matchesScope && matchesCurrency && matchesKeyword;
  });
}
