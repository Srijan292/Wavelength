import { useCallback, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { PlayerProvider } from "./context/PlayerContext";
import { AuthScreen } from "./components/Auth/AuthScreen";
import { AppShell } from "./components/Layout/AppShell";
import { Library } from "./components/Library/Library";
import { NowPlaying } from "./components/Player/NowPlaying";
import { PlayerBar } from "./components/Player/PlayerBar";
import { QueuePanel } from "./components/Player/QueuePanel";

function SignedInApp() {
  const [queueOpen, setQueueOpen] = useState(false);
  const toggleQueue = useCallback(() => setQueueOpen((open) => !open), []);
  const closeQueue = useCallback(() => setQueueOpen(false), []);

  return (
    <PlayerProvider>
      <AppShell>
        <NowPlaying />
        <Library />
      </AppShell>
      <QueuePanel open={queueOpen} onClose={closeQueue} />
      <PlayerBar queueOpen={queueOpen} onToggleQueue={toggleQueue} />
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
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
