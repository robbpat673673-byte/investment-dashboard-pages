export type StaticTheme = "light" | "dark";

export const STATIC_THEME_KEY = "static-dashboard:theme";

export function readStaticTheme(storage: Pick<Storage, "getItem"> | null | undefined): StaticTheme {
  return storage?.getItem(STATIC_THEME_KEY) === "dark" ? "dark" : "light";
}

export function applyStaticTheme(theme: StaticTheme, root: Pick<HTMLElement, "dataset">): void {
  root.dataset.theme = theme;
}
