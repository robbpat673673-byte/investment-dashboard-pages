import { describe, expect, it } from "vitest";
import { parseThemePreference, toggleThemePreference } from "./themePreference";

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
});
