/*
 * ThemeSwitcher — small button that cycles light → dark → hc → light.
 *
 * Cycles rather than opens a menu because a three-way cycle is cheaper
 * both in code and in interaction cost. If we add more themes (portal,
 * large-print, …) swap this for a DropdownMenu.
 */

import { useUiStore } from "../../stores/ui";

const labels = {
  light: "Light",
  dark: "Dark",
  hc: "High contrast",
} as const;

const glyphs = {
  light: "☀",
  dark: "☾",
  hc: "◐",
} as const;

export function ThemeSwitcher() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  function cycle() {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("hc");
    else setTheme("light");
  }

  return (
    <button
      type="button"
      onClick={cycle}
      className="ctp-theme-switcher"
      aria-label={`Theme: ${labels[theme]}. Click to change.`}
      title={`Theme: ${labels[theme]}`}
    >
      <span aria-hidden="true">{glyphs[theme]}</span>
      <span className="ctp-sr-only">Current theme: {labels[theme]}</span>
    </button>
  );
}
