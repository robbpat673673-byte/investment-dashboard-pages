export type FundScope = "all" | "domestic" | "foreign";

export type FilterableFund = {
  name: string;
  code: string | null;
  isin?: string | null;
  bankCode?: string | null;
  fundType: "domestic" | "foreign";
  currency: string;
};

export type FundFilters = {
  query: string;
  scope: FundScope;
  currency: string;
};

export function filterFunds<T extends FilterableFund>(funds: T[], filters: FundFilters): T[] {
  const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("zh-TW").replace(/[\s\-_/]/g, "");
  const keyword = normalize(filters.query.trim());
  return funds.filter(fund => {
    const matchesScope = filters.scope === "all" || fund.fundType === filters.scope;
    const matchesCurrency = filters.currency === "all" || fund.currency === filters.currency;
    const haystack = normalize(`${fund.name} ${fund.code ?? ""} ${fund.isin ?? ""} ${fund.bankCode ?? ""}`);
    const matchesKeyword = !keyword || haystack.includes(keyword);
    return matchesScope && matchesCurrency && matchesKeyword;
  });
}
