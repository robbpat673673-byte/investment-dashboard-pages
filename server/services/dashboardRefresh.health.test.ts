import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDbMock, limitMock } = vi.hoisted(() => ({ getDbMock: vi.fn(), limitMock: vi.fn() }));

vi.mock("../db", () => ({ getDb: getDbMock }));

import { getRSSHealthHistory } from "./dashboardRefresh";

describe("RSS health history service", () => {
  beforeEach(() => {
    limitMock.mockReset();
    getDbMock.mockReset();
  });

  it("依時間反轉為由舊到新並保留批次與延遲欄位", async () => {
    const rows = [
      { refreshRunId: 2, source: "B", status: "error", acceptedCount: 0, latencyMs: 900, recordedAt: new Date("2026-08-16T00:00:01.000Z") },
      { refreshRunId: 1, source: "A", status: "fresh", acceptedCount: 4, latencyMs: 300, recordedAt: new Date("2026-08-15T00:00:00.000Z") },
    ];
    limitMock.mockResolvedValue(rows);
    const orderBy = vi.fn(() => ({ limit: limitMock }));
    const from = vi.fn(() => ({ orderBy }));
    getDbMock.mockResolvedValue({ select: vi.fn(() => ({ from })) });
    const result = await getRSSHealthHistory(21);
    expect(limitMock).toHaveBeenCalledWith(21 * 7);
    expect(result[0]).toMatchObject({ refreshRunId: 1, source: "A", latencyMs: 300 });
    expect(result[1]).toMatchObject({ refreshRunId: 2, source: "B", status: "error", latencyMs: 900 });
  });

  it("資料庫未連線或沒有資料時回傳空陣列", async () => {
    getDbMock.mockResolvedValue(null);
    await expect(getRSSHealthHistory(14)).resolves.toEqual([]);
    getDbMock.mockResolvedValue({ select: vi.fn(() => ({ from: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })) })) })) });
    await expect(getRSSHealthHistory(14)).resolves.toEqual([]);
  });
});
