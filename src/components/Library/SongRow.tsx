import { useState, type FormEvent } from "react";
import type { Song } from "../../lib/backend";
import { formatDuration } from "../../lib/format";
import { PauseIcon, PlayIcon } from "../icons";

interface SongRowProps {
  song: Song;
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onQueue: () => void;
  onDelete: () => void;
  onRename: (patch: { title: string; artist: string | null }) => Promise<unknown>;
}

export function SongRow({
  song,
  index,
  isActive,
  isPlaying,
  onPlay,
  onQueue,
  onDelete,
  onRename,
}: SongRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(song.title);
  const [artist, setArtist] = useState(song.artist ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function startEditing() {
    setTitle(song.title);
    setArtist(song.artist ?? "");
    setSaveError(null);
    setIsEditing(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setSaveError("A song needs a title.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await onRename({ title: trimmedTitle, artist: artist.trim() || null });
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (isEditing) {
    return (
      <form className="song-row song-row--editing" onSubmit={handleSave}>
        <span className="song-row__number">{index + 1}</span>
        <div className="song-row__edit-fields">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            aria-label="Title"
            autoFocus
          />
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Artist"
            aria-label="Artist"
          />
        </div>
        <div className="song-row__actions">
          <button type="submit" className="btn-text" disabled={saving}>
            Save
          </button>
          <button
            type="button"
            className="btn-text"
            onClick={() => setIsEditing(false)}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
        {saveError && (
          <p className="form-error song-row__error" role="alert">
            {saveError}
          </p>
        )}
      </form>
    );
  }

  const showPause = isActive && isPlaying;

  return (
    <div className={isActive ? "song-row song-row--active" : "song-row"}>
      <button
        type="button"
        className="song-row__play"
        onClick={onPlay}
        aria-label={showPause ? `Pause ${song.title}` : `Play ${song.title}`}
      >
        <span className="song-row__number">{index + 1}</span>
        <span className="song-row__glyph">
          {showPause ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
        </span>
      </button>

      <div className="song-row__meta">
        <span className="song-row__title">{song.title}</span>
        <span className="song-row__artist">{song.artist || "Unknown artist"}</span>
      </div>

      <span className="song-row__duration">{formatDuration(song.duration)}</span>

      <div className="song-row__actions">
        <button type="button" className="btn-text" onClick={onQueue}>
          Queue
        </button>
        <button type="button" className="btn-text" onClick={startEditing}>
          Edit
        </button>
        <button type="button" className="btn-text btn-text--danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}
