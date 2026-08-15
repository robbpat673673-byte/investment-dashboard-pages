import { describe, expect, it } from "vitest";
import { parseThemePreference, restoreThemePreference, toggleThemePreference } from "./themePreference";

describe("themePreference", () => {
  it("只接受已知的深色偏好值", () => {
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("unexpected")).toBe("light");
  });

  it("可在深色與淺色模式之間切換", () => {
    expect(toggleThemePreference("light")).toBe("dark");
    expect(toggleThemePreference("dark")).toBe("light");
  });

  it("重載時會讀取已保存的深色偏好並同步套用 html 類別", () => {
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    const toggle = (className: string, active: boolean) => {
      expect(className).toBe("dark");
      expect(active).toBe(true);
    };

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: { getItem: () => "dark" } },
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { documentElement: { classList: { toggle } } },
    });

    expect(restoreThemePreference()).toBe("dark");

    Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
    Object.defineProperty(globalThis, "document", { configurable: true, value: originalDocument });
  });
});
