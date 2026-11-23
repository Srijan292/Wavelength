import { useCallback, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { PlayerProvider } from "./context/PlayerContext";
import { AuthScreen } from "./components/Auth/AuthScreen";
import { AppShell } from "./components/Layout/AppShell";
import { Library } from "./components/Library/Library";
import { NowPlaying } from "./components/Player/NowPlaying";
import { EqualizerPanel } from "./components/Player/EqualizerPanel";
import { PlayerBar, type PanelName } from "./components/Player/PlayerBar";
import { QueuePanel } from "./components/Player/QueuePanel";
import { ThemeProvider } from "./context/ThemeContext";

function SignedInApp() {
  // One side panel at a time: opening one replaces the other.
  const [panel, setPanel] = useState<PanelName | null>(null);
  const togglePanel = useCallback(
    (name: PanelName) => setPanel((current) => (current === name ? null : name)),
    []
  );
  const closePanel = useCallback(() => setPanel(null), []);

  return (
    <PlayerProvider>
      <AppShell>
        <NowPlaying />
        <Library />
      </AppShell>
      <QueuePanel open={panel === "queue"} onClose={closePanel} />
      <EqualizerPanel open={panel === "eq"} onClose={closePanel} />
      <PlayerBar panel={panel} onTogglePanel={togglePanel} />
    </PlayerProvider>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="app-loading">Loading…</div>;
  }
  return user ? <SignedInApp /> : <AuthScreen />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
