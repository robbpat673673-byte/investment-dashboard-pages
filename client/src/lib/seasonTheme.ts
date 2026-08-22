export const SEASON_THEME_STORAGE_KEY = "investment-dashboard-season";

export const seasonThemeOptions = [
  { value: "spring", label: "春日" },
  { value: "summer", label: "夏日" },
  { value: "autumn", label: "秋日" },
  { value: "winter", label: "冬夜" },
] as const;

export type SeasonTheme = (typeof seasonThemeOptions)[number]["value"];

const seasonClasses = seasonThemeOptions.map(option => `season-${option.value}`);

export function parseSeasonTheme(value: string | null | undefined): SeasonTheme {
  return seasonThemeOptions.some(option => option.value === value) ? value as SeasonTheme : "spring";
}

export function applySeasonTheme(value: SeasonTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove(...seasonClasses);
  root.classList.add(`season-${value}`);
}

/** 在 React 掛載前同步背景偏好，避免首次繪製時季節底色跳動。 */
export function restoreSeasonTheme(): SeasonTheme {
  if (typeof window === "undefined") return "spring";
  const season = parseSeasonTheme(window.localStorage.getItem(SEASON_THEME_STORAGE_KEY));
  applySeasonTheme(season);
  return season;
}
