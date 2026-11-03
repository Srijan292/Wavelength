import type { CSSProperties } from "react";
import { usePlayer, usePlayerTime } from "../../context/PlayerContext";
import { formatDuration } from "../../lib/format";
import {
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  QueueIcon,
  SpinnerIcon,
  VolumeIcon,
} from "../icons";

interface PlayerBarProps {
  queueOpen: boolean;
  onToggleQueue: () => void;
}

function fillStyle(value: number, max: number): CSSProperties {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return { "--fill": `${percent}%` } as CSSProperties;
}

// Lives in its own component so the per-tick time updates only re-render this.
function SeekBar() {
  const { currentSong, seekTo } = usePlayer();
  const { currentTime, duration } = usePlayerTime();
  const max = duration || 0;
  const value = Math.min(currentTime, max);

  return (
    <div className="player-bar__progress">
      <span className="player-bar__time">{formatDuration(value)}</span>
      <input
        type="range"
        className="range"
        style={fillStyle(value, max)}
        min={0}
        max={max}
        step={0.1}
        value={value}
        onChange={(e) => seekTo(Number(e.target.value))}
        disabled={!currentSong || !duration}
        aria-label="Seek"
        aria-valuetext={`${formatDuration(value)} of ${formatDuration(max)}`}
      />
      <span className="player-bar__time player-bar__time--end">
        {formatDuration(max)}
      </span>
    </div>
  );
}

export function PlayerBar({ queueOpen, onToggleQueue }: PlayerBarProps) {
  const {
    currentSong,
    isPlaying,
    isBuffering,
    volume,
    error,
    togglePlayPause,
    playNext,
    playPrev,
    changeVolume,
  } = usePlayer();

  const hasSong = currentSong !== null;

  return (
    <div className="player-bar" role="region" aria-label="Player">
      <div className="player-bar__meta">
        <div className="player-bar__thumb" aria-hidden="true">
          {hasSong ? currentSong.title.charAt(0).toUpperCase() : ""}
        </div>
        <div className="player-bar__text">
          <p className="player-bar__title">
            {hasSong ? currentSong.title : "Nothing playing"}
          </p>
          <p className="player-bar__artist">
            {hasSong ? currentSong.artist || "Unknown artist" : "Choose a song"}
          </p>
        </div>
      </div>

      <div className="player-bar__controls">
        <button
          type="button"
          className="btn-icon"
          onClick={playPrev}
          disabled={!hasSong}
          aria-label="Previous track"
        >
          <PrevIcon size={14} />
        </button>
        <button
          type="button"
          className="btn-icon btn-icon--primary"
          onClick={() => void togglePlayPause()}
          disabled={!hasSong}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isBuffering ? (
            <SpinnerIcon />
          ) : isPlaying ? (
            <PauseIcon />
          ) : (
            <PlayIcon />
          )}
        </button>
        <button
          type="button"
          className="btn-icon"
          onClick={playNext}
          disabled={!hasSong}
          aria-label="Next track"
        >
          <NextIcon size={14} />
        </button>
      </div>

      <SeekBar />

      <div className="player-bar__extras">
        <div className="player-bar__volume">
          <VolumeIcon />
          <input
            type="range"
            className="range range--volume"
            style={fillStyle(volume, 1)}
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => changeVolume(Number(e.target.value))}
            aria-label="Volume"
          />
        </div>
        <button
          type="button"
          className={queueOpen ? "btn-icon btn-icon--toggled" : "btn-icon"}
          onClick={onToggleQueue}
          aria-label="Queue"
          aria-pressed={queueOpen}
        >
          <QueueIcon />
        </button>
      </div>

      {error && (
        <p className="player-bar__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
