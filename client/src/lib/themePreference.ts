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
