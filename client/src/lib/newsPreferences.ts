export const NEWS_PREFERENCES_KEY = "investment-dashboard-news-preferences";

export type NewsPreferenceState = { favorites: string[]; readLater: string[] };

const emptyState = (): NewsPreferenceState => ({ favorites: [], readLater: [] });

export function parseNewsPreferences(raw: string | null): NewsPreferenceState {
  if (!raw) return emptyState();
  try {
    const value = JSON.parse(raw) as Partial<NewsPreferenceState>;
    return {
      favorites: Array.isArray(value.favorites) ? Array.from(new Set(value.favorites.filter(item => typeof item === "string"))) : [],
      readLater: Array.isArray(value.readLater) ? Array.from(new Set(value.readLater.filter(item => typeof item === "string"))) : [],
    };
  } catch {
    return emptyState();
  }
}

export function serializeNewsPreferences(value: NewsPreferenceState) {
  return JSON.stringify({ favorites: Array.from(new Set(value.favorites)), readLater: Array.from(new Set(value.readLater)) });
}

export function toggleNewsPreference(items: string[], id: string) {
  return items.includes(id) ? items.filter(item => item !== id) : [...items, id];
}

export function filterNewsByPreference<T extends { id: number; preferenceId?: string }>(items: T[], state: NewsPreferenceState, mode: "all" | "favorites" | "readLater") {
  if (mode === "all") return items;
  const selected = mode === "favorites" ? state.favorites : state.readLater;
  return items.filter(item => selected.includes(item.preferenceId ?? String(item.id)));
}
