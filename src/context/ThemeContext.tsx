import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyTheme,
  loadThemeSettings,
  resolveTheme,
  saveThemeSettings,
  type AccentName,
  type ResolvedTheme,
  type ThemeChoice,
} from "../lib/theme";

interface ThemeContextValue {
  theme: ThemeChoice;
  accent: AccentName;
  /** What `theme` currently looks like: "system" resolved to dark or light. */
  resolved: ResolvedTheme;
  setTheme: (theme: ThemeChoice) => void;
  setAccent: (accent: AccentName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(loadThemeSettings);
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolveTheme(settings.theme)
  );

  // The <html> attributes are written inside the handlers, not in an effect:
  // child effects (like the spectrum reading the accent color) run before a
  // parent's effect, so they would otherwise see the old colors.
  const update = useCallback((theme: ThemeChoice, accent: AccentName) => {
    setResolved(applyTheme(theme, accent));
    setSettings({ theme, accent });
    saveThemeSettings(theme, accent);
  }, []);

  const setTheme = useCallback(
    (theme: ThemeChoice) => update(theme, settings.accent),
    [update, settings.accent]
  );
  const setAccent = useCallback(
    (accent: AccentName) => update(settings.theme, accent),
    [update, settings.theme]
  );

  // Follow the operating system while "System" is selected.
  useEffect(() => {
    if (settings.theme !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const handleChange = () => setResolved(applyTheme("system", settings.accent));
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, [settings.theme, settings.accent]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: settings.theme,
      accent: settings.accent,
      resolved,
      setTheme,
      setAccent,
    }),
    [settings, resolved, setTheme, setAccent]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
