import React, { useEffect, useState } from "react";
import { applyThemePreference, parseThemePreference, THEME_PREFERENCE_STORAGE_KEY, toggleThemePreference, type ThemePreference } from "@/lib/themePreference";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePreference>(() => typeof window === "undefined" ? "light" : parseThemePreference(window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY)));

  useEffect(() => { applyThemePreference(theme); }, [theme]);

  const toggleTheme = () => {
    const next = toggleThemePreference(theme);
    setTheme(next);
    window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, next);
  };

  const isDark = theme === "dark";
  return <button type="button" className={`theme-toggle ${isDark ? "is-dark" : ""}`} onClick={toggleTheme} aria-pressed={isDark} aria-label={isDark ? "切換為淺色模式" : "切換為深色模式"} title={isDark ? "切換為淺色模式" : "切換為深色模式"}><span className="theme-celestial" aria-hidden="true"><i className="theme-sun-icon" /><i className="theme-moon-icon" /></span><span className="theme-toggle-label">{isDark ? "淺色" : "深色"}</span></button>;
}
