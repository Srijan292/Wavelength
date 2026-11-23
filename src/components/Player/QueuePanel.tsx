import { usePlayer } from "../../context/PlayerContext";
import { formatDuration } from "../../lib/format";
import { PauseIcon, PlayIcon, RepeatIcon, RepeatOneIcon, ShuffleIcon } from "../icons";
import { Drawer } from "./Drawer";

interface QueuePanelProps {
  open: boolean;
  onClose: () => void;
}

const REPEAT_LABEL = { off: "Repeat: off", all: "Repeat: all", one: "Repeat: one" } as const;

export function QueuePanel({ open, onClose }: QueuePanelProps) {
  const {
    queue,
    currentIndex,
    isPlaying,
    shuffle,
    repeat,
    jumpTo,
    togglePlayPause,
    toggleShuffle,
    cycleRepeat,
  } = usePlayer();

  const modeButtons = (
    <>
      <button
        type="button"
        className={shuffle ? "btn-icon btn-icon--toggled" : "btn-icon"}
        onClick={toggleShuffle}
        aria-label="Shuffle"
        aria-pressed={shuffle}
      >
        <ShuffleIcon />
      </button>
      <button
        type="button"
        className={repeat !== "off" ? "btn-icon btn-icon--toggled" : "btn-icon"}
        onClick={cycleRepeat}
        aria-label={REPEAT_LABEL[repeat]}
        aria-pressed={repeat !== "off"}
      >
        {repeat === "one" ? <RepeatOneIcon /> : <RepeatIcon />}
      </button>
    </>
  );

  return (
    <Drawer
      open={open}
      title="Queue"
      subtitle={`${queue.length} ${queue.length === 1 ? "song" : "songs"}`}
      actions={modeButtons}
      onClose={onClose}
    >
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
    </Drawer>
  );
}
