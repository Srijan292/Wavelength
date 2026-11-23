import type { CSSProperties } from "react";
import { usePlayer, usePlayerTime } from "../../context/PlayerContext";
import { formatDuration } from "../../lib/format";
import {
  EqIcon,
  MutedIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  QueueIcon,
  RepeatIcon,
  RepeatOneIcon,
  ShuffleIcon,
  SpinnerIcon,
  VolumeIcon,
} from "../icons";

export type PanelName = "queue" | "eq";

interface PlayerBarProps {
  panel: PanelName | null;
  onTogglePanel: (panel: PanelName) => void;
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

export function PlayerBar({ panel, onTogglePanel }: PlayerBarProps) {
  const {
    currentSong,
    isPlaying,
    isBuffering,
    volume,
    muted,
    shuffle,
    repeat,
    eqEnabled,
    error,
    togglePlayPause,
    playNext,
    playPrev,
    changeVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
  } = usePlayer();

  const silent = muted || volume === 0;

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
          className={
            shuffle
              ? "btn-icon btn-icon--small btn-icon--toggled player-bar__mode"
              : "btn-icon btn-icon--small player-bar__mode"
          }
          onClick={toggleShuffle}
          aria-label="Shuffle"
          aria-pressed={shuffle}
        >
          <ShuffleIcon />
        </button>
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
        <button
          type="button"
          className={
            repeat !== "off"
              ? "btn-icon btn-icon--small btn-icon--toggled player-bar__mode"
              : "btn-icon btn-icon--small player-bar__mode"
          }
          onClick={cycleRepeat}
          aria-label={`Repeat: ${repeat}`}
          aria-pressed={repeat !== "off"}
        >
          {repeat === "one" ? <RepeatOneIcon /> : <RepeatIcon />}
        </button>
      </div>

      <SeekBar />

      <div className="player-bar__extras">
        <div className="player-bar__volume">
          <button
            type="button"
            className="btn-icon btn-icon--small"
            onClick={toggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            aria-pressed={muted}
          >
            {silent ? <MutedIcon /> : <VolumeIcon />}
          </button>
          <input
            type="range"
            className="range range--volume"
            style={fillStyle(muted ? 0 : volume, 1)}
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => changeVolume(Number(e.target.value))}
            aria-label="Volume"
          />
        </div>
        <button
          type="button"
          className={
            panel === "eq" || eqEnabled ? "btn-icon btn-icon--toggled" : "btn-icon"
          }
          onClick={() => onTogglePanel("eq")}
          aria-label="Equalizer"
          aria-pressed={panel === "eq"}
        >
          <EqIcon />
        </button>
        <button
          type="button"
          className={panel === "queue" ? "btn-icon btn-icon--toggled" : "btn-icon"}
          onClick={() => onTogglePanel("queue")}
          aria-label="Queue"
          aria-pressed={panel === "queue"}
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
