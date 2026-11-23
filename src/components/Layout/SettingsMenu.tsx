import { useEffect, useId, useRef, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { ACCENTS, THEME_CHOICES } from "../../lib/theme";
import { ContrastIcon } from "../icons";

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "Space", action: "Play or pause" },
  { keys: "← →", action: "Back or forward 5 seconds" },
  { keys: "M", action: "Mute or unmute" },
  { keys: "Esc", action: "Close a panel" },
];

export function SettingsMenu() {
  const { theme, accent, setTheme, setAccent } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="settings" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={open ? "btn-icon btn-icon--toggled" : "btn-icon"}
        onClick={() => setOpen((value) => !value)}
        aria-label="Settings"
        aria-expanded={open}
        aria-controls={panelId}
      >
        <ContrastIcon />
      </button>

      {open && (
        <div className="settings__panel" id={panelId} role="dialog" aria-label="Settings">
          <section className="settings__section">
            <h3>Theme</h3>
            <div className="segmented" role="radiogroup" aria-label="Theme">
              {THEME_CHOICES.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  role="radio"
                  aria-checked={theme === choice.value}
                  className={theme === choice.value ? "segmented__item segmented__item--on" : "segmented__item"}
                  onClick={() => setTheme(choice.value)}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </section>

          <section className="settings__section">
            <h3>Accent color</h3>
            <div className="swatches" role="radiogroup" aria-label="Accent color">
              {ACCENTS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={accent === option.value}
                  aria-label={option.label}
                  title={option.label}
                  className={accent === option.value ? "swatch swatch--on" : "swatch"}
                  style={{ backgroundColor: option.swatch }}
                  onClick={() => setAccent(option.value)}
                />
              ))}
            </div>
          </section>

          <section className="settings__section">
            <h3>Keyboard shortcuts</h3>
            <dl className="shortcuts">
              {SHORTCUTS.map((item) => (
                <div key={item.keys} className="shortcuts__row">
                  <dt>
                    <kbd>{item.keys}</kbd>
                  </dt>
                  <dd>{item.action}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      )}
    </div>
  );
}
