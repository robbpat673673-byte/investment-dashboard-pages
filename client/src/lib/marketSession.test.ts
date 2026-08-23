import { describe, expect, it } from "vitest";
import { getMarketSession } from "./marketSession";

describe("市場本地交易時段", () => {
  it("週日會顯示週末休市，而不把前一交易日資料當成當日未更新", () => {
    const session = getMarketSession("^TWII", new Date("2026-08-23T00:00:00.000Z"));
    expect(session).toMatchObject({ timezoneLabel: "台北時間 CST", state: "closed", stateLabel: "週末休市" });
  });

  it("依美東夏令時間判斷美股標準時段為開盤中", () => {
    const session = getMarketSession("^GSPC", new Date("2026-08-21T14:00:00.000Z"));
    expect(session).toMatchObject({ timezoneLabel: "美東時間 ET", state: "open", stateLabel: "開盤中" });
  });

  it("保留日本午間休市的分段交易資訊", () => {
    const session = getMarketSession("^N225", new Date("2026-08-21T03:00:00.000Z"));
    expect(session).toMatchObject({ state: "break", stateLabel: "午間休市" });
  });
});
