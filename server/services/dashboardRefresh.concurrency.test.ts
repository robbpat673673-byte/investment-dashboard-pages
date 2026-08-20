import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./dashboardRefresh";

describe("mapWithConcurrency", () => {
  it("preserves input order while processing work concurrently", async () => {
    const started: number[] = [];
    const result = await mapWithConcurrency([1, 2, 3, 4], 2, async value => {
      started.push(value);
      await new Promise(resolve => setTimeout(resolve, value === 1 ? 10 : 1));
      return value * 10;
    });
    expect(result).toEqual([10, 20, 30, 40]);
    expect(started).toHaveLength(4);
  });

  it("returns an empty result without starting workers", async () => {
    await expect(mapWithConcurrency([], 4, async value => value)).resolves.toEqual([]);
  });

  it("stops workers when the refresh signal is aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(mapWithConcurrency([1, 2], 2, async value => value, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  });
});
