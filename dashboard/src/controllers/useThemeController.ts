import { useEffect, useState } from "react";

import { isThemeId, THEME_SWITCHER_ENABLED, type ThemeId } from "../models/theme";

const STORAGE_KEY = "clustermap-theme";

function initialTheme(): ThemeId {
  const stored = typeof window.localStorage?.getItem === "function"
    ? window.localStorage.getItem(STORAGE_KEY)
    : null;
  const resolved = THEME_SWITCHER_ENABLED && isThemeId(stored) ? stored : "maxpane";
  document.documentElement.dataset.theme = resolved;
  return resolved;
}

export function useThemeController() {
  const [theme, setTheme] = useState<ThemeId>(initialTheme);

  useEffect(() => {
    if (THEME_SWITCHER_ENABLED && typeof window.localStorage?.setItem === "function") {
      window.localStorage.setItem(STORAGE_KEY, theme);
    }
  }, [theme]);

  return {
    theme,
    setTheme: (nextTheme: ThemeId) => {
      if (!THEME_SWITCHER_ENABLED) return;
      document.documentElement.dataset.theme = nextTheme;
      setTheme(nextTheme);
    },
  } as const;
}
