export const THEME_PREFERENCE_STORAGE_KEY = "investment-dashboard-theme";

export type ThemePreference = "light" | "dark";

export function parseThemePreference(value: string | null | undefined): ThemePreference {
  return value === "dark" ? "dark" : "light";
}

export function toggleThemePreference(value: ThemePreference): ThemePreference {
  return value === "dark" ? "light" : "dark";
}

export function applyThemePreference(value: ThemePreference) {
  if (typeof document !== "undefined") document.documentElement.classList.toggle("dark", value === "dark");
}

/** 在 React 掛載前同步已保存的偏好，避免重載時按鈕狀態與頁面配色不同步。 */
export function restoreThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "light";
  const theme = parseThemePreference(window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY));
  applyThemePreference(theme);
  return theme;
}
