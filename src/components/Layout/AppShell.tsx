import type { ReactNode } from "react";
import { useAuth } from "../../context/AuthContext";
import { WaveMark } from "../icons";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut, mode } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-bar">
        <span className="app-bar__brand">
          <WaveMark />
          Wavelength
        </span>
        <div className="app-bar__user">
          {mode === "demo" && <span className="app-bar__demo">Demo mode</span>}
          <span className="app-bar__email">{user?.email}</span>
          <button type="button" className="btn-text" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
