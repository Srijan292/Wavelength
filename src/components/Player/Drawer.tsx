import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "../icons";

interface DrawerProps {
  open: boolean;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/** The slide-in side panel shared by the queue and the equalizer. */
export function Drawer({ open, title, subtitle, actions, onClose, children }: DrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      // A confirm dialog handles its own Escape.
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <aside
      className={open ? "drawer drawer--open" : "drawer"}
      aria-label={title}
      aria-hidden={!open}
    >
      <header className="drawer__header">
        <h2>{title}</h2>
        <span className="drawer__sub">{subtitle}</span>
        {actions && <div className="drawer__actions">{actions}</div>}
        <button
          ref={closeRef}
          type="button"
          className="btn-icon"
          onClick={onClose}
          aria-label={`Close ${title.toLowerCase()}`}
        >
          <CloseIcon />
        </button>
      </header>
      {children}
    </aside>
  );
}
