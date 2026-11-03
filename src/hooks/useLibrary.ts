import { useCallback, useEffect, useState } from "react";
import { backend, type Song, type SongPatch } from "../lib/backend";
import { readAudioDuration } from "../lib/audioMeta";
import { useAuth } from "../context/AuthContext";

export function useLibrary() {
  const { user } = useAuth();
  const userId = user?.id;
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    backend
      .listSongs()
      .then((list) => {
        if (cancelled) return;
        setSongs(list);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Could not load your library."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const upload = useCallback(async (file: File) => {
    const duration = await readAudioDuration(file);
    const song = await backend.addSong(file, duration);
    setSongs((prev) => [song, ...prev]);
    return song;
  }, []);

  const rename = useCallback(async (id: string, patch: SongPatch) => {
    const updated = await backend.updateSong(id, patch);
    setSongs((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
  }, []);

  const remove = useCallback(async (song: Song) => {
    await backend.removeSong(song);
    setSongs((prev) => prev.filter((s) => s.id !== song.id));
  }, []);

  return { songs, loading, error, upload, rename, remove };
}
