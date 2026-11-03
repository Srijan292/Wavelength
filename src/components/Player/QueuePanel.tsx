import { useEffect, useRef } from "react";
import { usePlayer } from "../../context/PlayerContext";
import { formatDuration } from "../../lib/format";
import { CloseIcon, PauseIcon, PlayIcon } from "../icons";

interface QueuePanelProps {
  open: boolean;
  onClose: () => void;
}

export function QueuePanel({ open, onClose }: QueuePanelProps) {
  const { queue, currentIndex, isPlaying, jumpTo, togglePlayPause } =
    usePlayer();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <aside
      className={open ? "queue queue--open" : "queue"}
      aria-label="Queue"
      aria-hidden={!open}
    >
      <header className="queue__header">
        <h2>Queue</h2>
        <span className="queue__count">
          {queue.length} {queue.length === 1 ? "song" : "songs"}
        </span>
        <button
          ref={closeRef}
          type="button"
          className="btn-icon"
          onClick={onClose}
          aria-label="Close queue"
        >
          <CloseIcon />
        </button>
      </header>

      {queue.length === 0 ? (
        <p className="queue__empty">
          The queue is empty. Play a song from your library, or use Queue on a
          song to add it.
        </p>
      ) : (
        <ol className="queue__list">
          {queue.map((song, index) => {
            const isCurrent = index === currentIndex;
            return (
              <li key={`${song.id}-${index}`}>
                <button
                  type="button"
                  className={
                    isCurrent ? "queue__item queue__item--current" : "queue__item"
                  }
                  onClick={() => (isCurrent ? void togglePlayPause() : jumpTo(index))}
                  aria-current={isCurrent ? "true" : undefined}
                >
                  <span className="queue__marker">
                    {isCurrent ? (
                      isPlaying ? (
                        <PauseIcon size={12} />
                      ) : (
                        <PlayIcon size={12} />
                      )
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="queue__meta">
                    <span className="queue__title">{song.title}</span>
                    <span className="queue__artist">
                      {song.artist || "Unknown artist"}
                    </span>
                  </span>
                  <span className="queue__duration">
                    {formatDuration(song.duration)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}
