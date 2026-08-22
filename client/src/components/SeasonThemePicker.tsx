import React, { useEffect, useState } from "react";
import { applySeasonTheme, parseSeasonTheme, seasonThemeOptions, SEASON_THEME_STORAGE_KEY, type SeasonTheme } from "@/lib/seasonTheme";

export function SeasonThemePicker() {
  const [season, setSeason] = useState<SeasonTheme>(() => typeof window === "undefined" ? "spring" : parseSeasonTheme(window.localStorage.getItem(SEASON_THEME_STORAGE_KEY)));

  useEffect(() => { applySeasonTheme(season); }, [season]);

  const updateSeason = (next: SeasonTheme) => {
    setSeason(next);
    window.localStorage.setItem(SEASON_THEME_STORAGE_KEY, next);
  };

  return <label className="season-picker"><span className="season-picker-leaf" aria-hidden="true" /><span className="season-picker-label">季節</span><select aria-label="選擇季節背景" value={season} onChange={event => updateSeason(event.target.value as SeasonTheme)}>{seasonThemeOptions.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>;
}
