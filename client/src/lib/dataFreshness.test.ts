import { describe, expect, it } from "vitest";
import { classifyDataFreshness } from "./dataFreshness";

describe("classifyDataFreshness", () => {
  const now = new Date("2026-08-20T13:00:00+08:00");

  it("recognizes today's data", () => {
    expect(classifyDataFreshness("2026-08-20", now, "market").kind).toBe("latest");
  });

  it("labels the prior trading day separately from delayed data", () => {
    expect(classifyDataFreshness("2026-08-19", now, "market").kind).toBe("previous-trading-day");
    expect(classifyDataFreshness("2026-08-18", now, "market").kind).toBe("previous-trading-day");
    expect(classifyDataFreshness("2026-08-17", now, "domestic-fund").kind).toBe("delayed");
  });

  it("labels a recent foreign NAV as foreign publication lag", () => {
    expect(classifyDataFreshness("2026-08-18", now, "foreign-fund").kind).toBe("foreign-lag");
  });

  it("handles short market dates and missing dates", () => {
    expect(classifyDataFreshness("08/18", now, "market").kind).toBe("previous-trading-day");
    expect(classifyDataFreshness(null, now, "market").kind).toBe("missing");
  });
});
