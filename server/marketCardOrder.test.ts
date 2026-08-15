import { describe, expect, it } from "vitest";
import { moveMarketCard, orderMarketCards } from "../client/src/lib/marketCardOrder";

const market = [
  { ticker: "^DJI", showAsCard: true },
  { ticker: "^IXIC", showAsCard: true },
  { ticker: "^GSPC", showAsCard: true },
  { ticker: "TSM", showAsCard: false },
];

describe("market card order", () => {
  it("uses the saved order while retaining new visible cards", () => {
    expect(orderMarketCards(market, ["^GSPC", "^DJI"]).map(item => item.ticker)).toEqual(["^GSPC", "^DJI", "^IXIC"]);
  });

  it("moves a dragged card before the target card", () => {
    expect(moveMarketCard(["^DJI", "^IXIC", "^GSPC"], "^GSPC", "^DJI")).toEqual(["^GSPC", "^DJI", "^IXIC"]);
  });

  it("does not alter an invalid or unchanged ordering request", () => {
    const original = ["^DJI", "^IXIC"];
    expect(moveMarketCard(original, "^DJI", "^DJI")).toEqual(original);
    expect(moveMarketCard(original, "^GSPC", "^DJI")).toEqual(original);
  });
});
