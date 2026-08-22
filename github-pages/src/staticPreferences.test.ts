// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { applyStaticTheme, readStaticTheme, STATIC_THEME_KEY } from "./staticPreferences";

describe("靜態版主題偏好", () => {
  afterEach(() => localStorage.clear());

  it("僅還原已保存的深色模式，其餘值回退為淺色", () => {
    localStorage.setItem(STATIC_THEME_KEY, "dark");
    expect(readStaticTheme(localStorage)).toBe("dark");
    localStorage.setItem(STATIC_THEME_KEY, "unexpected");
    expect(readStaticTheme(localStorage)).toBe("light");
  });

  it("將主題套用至根元素 dataset", () => {
    applyStaticTheme("dark", document.documentElement);
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
