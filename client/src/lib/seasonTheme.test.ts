import { describe, expect, it } from "vitest";
import { applySeasonTheme, parseSeasonTheme, restoreSeasonTheme } from "./seasonTheme";

describe("seasonTheme", () => {
  it("只接受支援的季節背景值", () => {
    expect(parseSeasonTheme("spring")).toBe("spring");
    expect(parseSeasonTheme("winter")).toBe("winter");
    expect(parseSeasonTheme("unexpected")).toBe("spring");
  });

  it("套用季節時會清除舊類別並保留新的根類別", () => {
    const originalDocument = globalThis.document;
    const removed: string[][] = [];
    const added: string[] = [];
    Object.defineProperty(globalThis, "document", { configurable: true, value: { documentElement: { classList: { remove: (...values: string[]) => removed.push(values), add: (value: string) => added.push(value) } } } });
    applySeasonTheme("autumn");
    expect(removed[0]).toEqual(["season-spring", "season-summer", "season-autumn", "season-winter"]);
    expect(added).toEqual(["season-autumn"]);
    Object.defineProperty(globalThis, "document", { configurable: true, value: originalDocument });
  });

  it("重載時會讀取本機保存的背景偏好", () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const added: string[] = [];
    Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: { getItem: () => "summer" } } });
    Object.defineProperty(globalThis, "document", { configurable: true, value: { documentElement: { classList: { remove: () => undefined, add: (value: string) => added.push(value) } } } });
    expect(restoreSeasonTheme()).toBe("summer");
    expect(added).toContain("season-summer");
    Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
    Object.defineProperty(globalThis, "document", { configurable: true, value: originalDocument });
  });
});
