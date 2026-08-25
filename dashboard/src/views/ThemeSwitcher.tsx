import { THEMES, type ThemeId } from "../models/theme";

export function ThemeSwitcher({ theme, onChange }: { readonly theme: ThemeId; readonly onChange: (theme: ThemeId) => void }) {
  return (
    <fieldset className="theme-switcher">
      <legend className="sr-only">Choose color theme</legend>
      {THEMES.map((option) => (
        <button
          type="button"
          key={option.id}
          aria-pressed={theme === option.id}
          onClick={() => onChange(option.id)}
        >
          <span className={`theme-swatch theme-swatch--${option.id}`} aria-hidden="true" />
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}
