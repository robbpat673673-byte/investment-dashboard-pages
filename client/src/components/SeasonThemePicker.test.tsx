// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SeasonThemePicker } from "./SeasonThemePicker";
import { SEASON_THEME_STORAGE_KEY } from "@/lib/seasonTheme";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.documentElement.classList.remove("season-spring", "season-summer", "season-autumn", "season-winter");
});

describe("SeasonThemePicker", () => {
  it("選擇季節後會更新根元素並保存於本機", () => {
    render(<SeasonThemePicker />);
    fireEvent.change(screen.getByLabelText("選擇季節背景"), { target: { value: "winter" } });
    expect(window.localStorage.getItem(SEASON_THEME_STORAGE_KEY)).toBe("winter");
    expect(document.documentElement.classList.contains("season-winter")).toBe(true);
  });
});
