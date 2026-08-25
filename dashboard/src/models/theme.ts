export type ThemeId = "light" | "dark" | "maxpane";

// Keep the three-theme implementation ready, but ship the focused MaxPane UI for now.
export const THEME_SWITCHER_ENABLED = false;

export const THEMES: readonly { readonly id: ThemeId; readonly label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "maxpane", label: "MaxPane" },
];

export function isThemeId(value: string | null): value is ThemeId {
  return value === "light" || value === "dark" || value === "maxpane";
}
