import { describe, expect, it } from "vitest";
import { MARKET_CARD_HISTORY_TICKERS } from "./dashboardRefresh";

describe("市場卡片歷史序列範圍", () => {
  it("為所有顯示於全球市場卡片的指數安排歷史抓取，而非只補 S&P 500", () => {
    expect(MARKET_CARD_HISTORY_TICKERS).toEqual([
      "^DJI",
      "^IXIC",
      "^GSPC",
      "^N225",
      "^HSI",
      "^TWII",
      "^KS11",
      "^SOX",
    ]);
  });
});
