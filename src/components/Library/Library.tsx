import { useState } from "react";
import { useLibrary } from "../../hooks/useLibrary";
import { usePlayer } from "../../context/PlayerContext";
import type { Song } from "../../lib/backend";
import { UploadButton } from "./UploadButton";
import { SongRow } from "./SongRow";

export function Library() {
  const { songs, loading, error, upload, rename, remove } = useLibrary();
  const {
    currentSong,
    isPlaying,
    playQueue,
    togglePlayPause,
    addToQueue,
    forgetSong,
    syncSong,
  } = usePlayer();
  const [actionError, setActionError] = useState<string | null>(null);

  function handleRowPlay(song: Song, index: number) {
    if (currentSong?.id === song.id) {
      void togglePlayPause();
    } else {
      playQueue(songs, index);
    }
  }

  async function handleDelete(song: Song) {
    const confirmed = window.confirm(`Delete "${song.title}"? This can't be undone.`);
    if (!confirmed) return;
    setActionError(null);
    try {
      await remove(song);
      forgetSong(song.id);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : `Couldn't delete "${song.title}".`
      );
    }
  }

  async function handleRename(
    song: Song,
    patch: { title: string; artist: string | null }
  ) {
    const updated = await rename(song.id, patch);
    syncSong(updated);
  }

  return (
    <section className="library" aria-labelledby="library-heading">
      <header className="library__header">
        <div className="library__heading">
          <h2 id="library-heading">Your library</h2>
          {!loading && (
            <span className="library__count">
              {songs.length} {songs.length === 1 ? "song" : "songs"}
            </span>
          )}
        </div>
        <UploadButton onUpload={upload} />
      </header>

      {(error || actionError) && (
        <p className="form-error library__error" role="alert">
          {error ?? actionError}
        </p>
      )}

      {loading ? (
        <p className="library__empty">Loading your songs…</p>
      ) : songs.length === 0 ? (
        <p className="library__empty">
          Your library is empty. Upload a song to start listening.
        </p>
      ) : (
        <div className="song-list">
          {songs.map((song, index) => (
            <SongRow
              key={song.id}
              song={song}
              index={index}
              isActive={currentSong?.id === song.id}
              isPlaying={isPlaying}
              onPlay={() => handleRowPlay(song, index)}
              onQueue={() => addToQueue(song)}
              onDelete={() => void handleDelete(song)}
              onRename={(patch) => handleRename(song, patch)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
