import { useMemo, useRef, useState, type DragEvent } from "react";
import { useLibrary } from "../../hooks/useLibrary";
import { useUploader } from "../../hooks/useUploader";
import { usePlayer } from "../../context/PlayerContext";
import type { Song } from "../../lib/backend";
import { readStored, writeStored } from "../../lib/storage";
import { ConfirmDialog } from "../ConfirmDialog";
import { UploadButton } from "./UploadButton";
import { SongRow } from "./SongRow";

type SortKey = "recent" | "title" | "artist" | "duration";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Recently added" },
  { value: "title", label: "Title" },
  { value: "artist", label: "Artist" },
  { value: "duration", label: "Duration" },
];

const isSortKey = (v: unknown): v is SortKey =>
  SORT_OPTIONS.some((option) => option.value === v);

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

function sortSongs(songs: Song[], key: SortKey): Song[] {
  if (key === "recent") return songs; // the backend already returns newest first
  const sorted = [...songs];
  if (key === "title") {
    sorted.sort((a, b) => collator.compare(a.title, b.title));
  } else if (key === "artist") {
    // Songs without an artist sink to the bottom instead of leading the list.
    sorted.sort((a, b) => {
      if (!a.artist && !b.artist) return collator.compare(a.title, b.title);
      if (!a.artist) return 1;
      if (!b.artist) return -1;
      return collator.compare(a.artist, b.artist) || collator.compare(a.title, b.title);
    });
  } else {
    sorted.sort((a, b) => (a.duration ?? 0) - (b.duration ?? 0));
  }
  return sorted;
}

function matchesQuery(song: Song, query: string): boolean {
  const haystack = `${song.title} ${song.artist ?? ""} ${song.album ?? ""}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

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
  const uploader = useUploader(upload);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>(() =>
    readStored<SortKey>("sort", "recent", isSortKey)
  );
  const [pendingDelete, setPendingDelete] = useState<Song | null>(null);

  // Drag-and-drop. dragenter/dragleave also fire for every child element, so a
  // depth counter (not a boolean) says whether the pointer is still inside.
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  const visibleSongs = useMemo(
    () => sortSongs(songs, sortKey).filter((song) => matchesQuery(song, query)),
    [songs, sortKey, query]
  );
  const isFiltering = query.trim().length > 0;

  function handleRowPlay(song: Song, index: number) {
    if (currentSong?.id === song.id) {
      void togglePlayPause();
    } else {
      playQueue(visibleSongs, index);
    }
  }

  async function confirmDelete() {
    const song = pendingDelete;
    if (!song) return;
    setPendingDelete(null);
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

  function handleSortChange(value: string) {
    if (!isSortKey(value)) return;
    setSortKey(value);
    writeStored("sort", value);
  }

  function handleDragEnter(e: DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }

  function handleDragOver(e: DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault(); // required, or the browser refuses the drop
    e.dataTransfer.dropEffect = "copy";
  }

  function handleDragLeave(e: DragEvent) {
    if (!hasFiles(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function handleDrop(e: DragEvent) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    void uploader.start(e.dataTransfer.files);
  }

  const countLabel = isFiltering
    ? `${visibleSongs.length} of ${songs.length}`
    : `${songs.length} ${songs.length === 1 ? "song" : "songs"}`;

  return (
    <section
      className="library"
      aria-labelledby="library-heading"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className="library__header">
        <div className="library__heading">
          <h2 id="library-heading">Your library</h2>
          {!loading && <span className="library__count">{countLabel}</span>}
        </div>
        <UploadButton
          busy={uploader.busy}
          progress={uploader.progress}
          errors={uploader.errors}
          hiddenErrors={uploader.hiddenErrors}
          onFiles={(files) => void uploader.start(files)}
        />
      </header>

      {!loading && songs.length > 0 && (
        <div className="library__tools">
          <input
            type="search"
            className="library__search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, artist or album"
            aria-label="Search your library"
          />
          <label className="library__sort">
            <span>Sort by</span>
            <select value={sortKey} onChange={(e) => handleSortChange(e.target.value)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {(error || actionError) && (
        <p className="form-error library__error" role="alert">
          {error ?? actionError}
        </p>
      )}

      {loading ? (
        <p className="library__empty">Loading your songs…</p>
      ) : songs.length === 0 ? (
        <p className="library__empty">
          Your library is empty. Upload a song, or drop audio files here, to
          start listening.
        </p>
      ) : visibleSongs.length === 0 ? (
        <div className="library__empty">
          <p>No songs match “{query.trim()}”.</p>
          <button type="button" className="btn-text" onClick={() => setQuery("")}>
            Clear search
          </button>
        </div>
      ) : (
        <div className="song-list">
          {visibleSongs.map((song, index) => (
            <SongRow
              key={song.id}
              song={song}
              index={index}
              isActive={currentSong?.id === song.id}
              isPlaying={isPlaying}
              onPlay={() => handleRowPlay(song, index)}
              onQueue={() => addToQueue(song)}
              onDelete={() => setPendingDelete(song)}
              onRename={(patch) => handleRename(song, patch)}
            />
          ))}
        </div>
      )}

      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <p>Drop audio files to add them to your library</p>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this song?"
        message={
          pendingDelete
            ? `“${pendingDelete.title}” will be removed from your library. This can't be undone.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
