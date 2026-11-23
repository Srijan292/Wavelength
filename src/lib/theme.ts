import { readStored, writeStored } from "./storage";

export type ThemeChoice = "system" | "dark" | "light";
export type ResolvedTheme = "dark" | "light";
export type AccentName = "amber" | "teal" | "rose" | "violet";

export const THEME_CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: "system", label: "System" },
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

// `swatch` is only used to paint the picker; the real colors live in base.css.
export const ACCENTS: { value: AccentName; label: string; swatch: string }[] = [
  { value: "amber", label: "Amber", swatch: "#d9a441" },
  { value: "teal", label: "Teal", swatch: "#3fb8a6" },
  { value: "rose", label: "Rose", swatch: "#e0698a" },
  { value: "violet", label: "Violet", swatch: "#9b87f5" },
];

const isThemeChoice = (v: unknown): v is ThemeChoice =>
  v === "system" || v === "dark" || v === "light";
const isAccent = (v: unknown): v is AccentName =>
  ACCENTS.some((accent) => accent.value === v);

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice !== "system") return choice;
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

/** Writes the theme to <html> so the CSS token sets switch immediately. */
export function applyTheme(choice: ThemeChoice, accent: AccentName): ResolvedTheme {
  const resolved = resolveTheme(choice);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.accent = accent;
  return resolved;
}

export function loadThemeSettings(): { theme: ThemeChoice; accent: AccentName } {
  return {
    theme: readStored<ThemeChoice>("theme", "dark", isThemeChoice),
    accent: readStored<AccentName>("accent", "amber", isAccent),
  };
}

export function saveThemeSettings(theme: ThemeChoice, accent: AccentName): void {
  writeStored("theme", theme);
  writeStored("accent", accent);
}
