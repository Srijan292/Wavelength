import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { backend, type Song } from "../lib/backend";
import { readStored, writeStored } from "../lib/storage";
import {
  EQ_BAND_COUNT,
  FLAT_GAINS,
  clampGain,
  createEqualizer,
  isGainList,
  type Equalizer,
} from "../lib/audio/equalizer";

export type RepeatMode = "off" | "all" | "one";

const isBool = (v: unknown): v is boolean => typeof v === "boolean";
const isRepeatMode = (v: unknown): v is RepeatMode =>
  v === "off" || v === "all" || v === "one";
const isVolume = (v: unknown): v is number =>
  typeof v === "number" && v >= 0 && v <= 1;
const HISTORY_LIMIT = 200;

interface PlayerContextValue {
  queue: Song[];
  currentIndex: number;
  currentSong: Song | null;
  isPlaying: boolean;
  isBuffering: boolean;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  eqEnabled: boolean;
  eqGains: number[];
  error: string | null;
  /** Replace the queue with `songs` and start playing at `startIndex`. */
  playQueue: (songs: Song[], startIndex: number) => void;
  /** Jump to an entry that is already in the queue. */
  jumpTo: (index: number) => void;
  addToQueue: (song: Song) => void;
  togglePlayPause: () => void;
  playNext: () => void;
  playPrev: () => void;
  seekTo: (time: number) => void;
  changeVolume: (value: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setEqEnabled: (enabled: boolean) => void;
  setEqBand: (index: number, gain: number) => void;
  setEqGains: (gains: number[]) => void;
  /** Call after a song is deleted: drops it from the queue and stops it if it was playing. */
  forgetSong: (id: string) => void;
  /** Call after a song is edited so the queue shows the new title/artist. */
  syncSong: (song: Song) => void;
  /** The analyser node feeding the spectrum display, once playback has started. */
  getAnalyser: () => AnalyserNode | null;
}

interface PlayerTimeValue {
  currentTime: number;
  duration: number;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);
// Time changes several times a second; keeping it in its own context means
// only the seek bar re-renders on every tick, not the whole library list.
const PlayerTimeContext = createContext<PlayerTimeValue | null>(null);

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [audioElement] = useState(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    // Required: without CORS mode, routing a cross-origin file (like a Supabase
    // signed URL) through the Web Audio API outputs silence.
    audio.crossOrigin = "anonymous";
    audio.volume = readStored("volume", 1, isVolume);
    return audio;
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  // Bumped on every load request and on stop, so a slow response for an
  // earlier track can never overwrite a newer one.
  const loadTokenRef = useRef(0);
  const equalizerRef = useRef<Equalizer | null>(null);
  // Shuffle bookkeeping, by song id: what has played this cycle, and the
  // order songs were visited so "previous" can walk back through a shuffle.
  const playedRef = useRef<Set<string>>(new Set());
  const historyRef = useRef<string[]>([]);

  const [queue, setQueue] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(() => audioElement.volume);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(() => readStored("shuffle", false, isBool));
  const [repeat, setRepeat] = useState<RepeatMode>(() =>
    readStored<RepeatMode>("repeat", "off", isRepeatMode)
  );
  const [eqEnabled, setEqEnabledState] = useState(() =>
    readStored("eqEnabled", false, isBool)
  );
  const [eqGains, setEqGainsState] = useState<number[]>(() =>
    readStored<number[]>("eqGains", FLAT_GAINS, isGainList)
  );
  const eqStateRef = useRef({ gains: eqGains, enabled: eqEnabled });
  const [error, setError] = useState<string | null>(null);

  const currentSong = currentIndex >= 0 ? (queue[currentIndex] ?? null) : null;

  // Builds the Web Audio graph once, on first playback (which always follows a
  // user gesture, so the context isn't left suspended by autoplay rules):
  //   <audio> -> source -> equalizer (10 filters + headroom) -> analyser
  //           -> gain -> speakers
  // The analyser sits after the equalizer so the spectrum shows what you hear.
  // Volume uses audio.volume, not the gain node, so the two never
  // double-attenuate.
  const ensureAudioGraph = useCallback((): AudioContext => {
    if (audioContextRef.current) return audioContextRef.current;

    const AudioContextClass: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;

    const context = new AudioContextClass();
    const source = context.createMediaElementSource(audioElement);
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048; // fine enough to separate bass notes
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10; // headroom so loud bass doesn't clip flat
    analyser.smoothingTimeConstant = 0.82;
    const gain = context.createGain();
    gain.gain.value = 1;
    const equalizer = createEqualizer(
      context,
      eqStateRef.current.gains,
      eqStateRef.current.enabled
    );

    source.connect(equalizer.input);
    equalizer.output.connect(analyser);
    analyser.connect(gain);
    gain.connect(context.destination);

    audioContextRef.current = context;
    analyserRef.current = analyser;
    equalizerRef.current = equalizer;
    return context;
  }, [audioElement]);

  const stopPlayback = useCallback(() => {
    loadTokenRef.current += 1;
    audioElement.pause();
    audioElement.removeAttribute("src");
    audioElement.load();
    // load() cancels the 'pause' event that pause() queued, so the listener
    // never hears about it; reset the flag ourselves.
    setIsPlaying(false);
    setIsBuffering(false);
    setCurrentTime(0);
    setDuration(0);
  }, [audioElement]);

  const loadSongAndPlay = useCallback(
    async (song: Song) => {
      const token = ++loadTokenRef.current;
      const isStale = () => token !== loadTokenRef.current;

      setError(null);
      setIsBuffering(true);
      setCurrentTime(0);
      setDuration(song.duration ?? 0);

      try {
        const url = await backend.getPlayableUrl(song);
        if (isStale()) return;

        const context = ensureAudioGraph();
        await context.resume();
        if (isStale()) return;

        audioElement.src = url;
        await audioElement.play();
      } catch (err) {
        if (isStale() || isAbortError(err)) return;
        setError(
          err instanceof Error ? err.message : "Could not play this track."
        );
      } finally {
        if (!isStale()) setIsBuffering(false);
      }
    },
    [ensureAudioGraph, audioElement]
  );

  /** Move to `index` of `list`, recording where we came from. */
  const goTo = useCallback(
    (index: number, list: Song[], recordHistory: boolean) => {
      const target = list[index];
      if (!target) return;
      if (recordHistory && currentSong && currentSong.id !== target.id) {
        historyRef.current.push(currentSong.id);
        if (historyRef.current.length > HISTORY_LIMIT) historyRef.current.shift();
      }
      playedRef.current.add(target.id);
      setCurrentIndex(index);
      void loadSongAndPlay(target);
    },
    [currentSong, loadSongAndPlay]
  );

  const playQueue = useCallback(
    (songsToPlay: Song[], startIndex: number) => {
      const target = songsToPlay[startIndex];
      if (!target) return;
      playedRef.current = new Set();
      historyRef.current = [];
      setQueue(songsToPlay);
      goTo(startIndex, songsToPlay, false);
    },
    [goTo]
  );

  const jumpTo = useCallback(
    (index: number) => goTo(index, queue, true),
    [goTo, queue]
  );

  const addToQueue = useCallback((song: Song) => {
    setQueue((prev) => [...prev, song]);
  }, []);

  const togglePlayPause = useCallback(async () => {
    if (!currentSong) return;

    // Nothing loaded (an earlier load failed) or the signed link went bad:
    // load the track afresh instead of calling play() on a dead element.
    if (!audioElement.getAttribute("src") || audioElement.error) {
      void loadSongAndPlay(currentSong);
      return;
    }

    if (isPlaying) {
      audioElement.pause();
      return;
    }

    try {
      await ensureAudioGraph().resume();
      await audioElement.play();
    } catch (err) {
      if (!isAbortError(err)) {
        setError("The browser blocked playback. Press play again.");
      }
    }
  }, [currentSong, isPlaying, audioElement, ensureAudioGraph, loadSongAndPlay]);

  // `auto` is true when a track ended by itself. Only then does "repeat one"
  // replay the same song; pressing Next always moves on.
  const advance = useCallback(
    (auto: boolean) => {
      if (!currentSong) return;

      if (auto && repeat === "one") {
        audioElement.currentTime = 0;
        void audioElement.play().catch(() => undefined);
        return;
      }

      let next = -1;
      if (shuffle) {
        const pickUnplayed = () =>
          queue
            .map((song, i) => (playedRef.current.has(song.id) ? -1 : i))
            .filter((i) => i >= 0);
        let candidates = pickUnplayed();
        if (candidates.length === 0 && repeat === "all") {
          // Everything has played: start a fresh cycle, avoiding an immediate
          // repeat of the current song when there is anything else.
          playedRef.current = new Set([currentSong.id]);
          candidates = pickUnplayed();
          if (candidates.length === 0 && queue.length > 0) candidates = [currentIndex];
        }
        if (candidates.length > 0) {
          next = candidates[Math.floor(Math.random() * candidates.length)];
        }
      } else {
        next = currentIndex + 1;
        if (next >= queue.length) next = repeat === "all" ? 0 : -1;
      }

      if (next < 0) {
        if (!auto) audioElement.pause();
        return;
      }
      goTo(next, queue, true);
    },
    [currentSong, currentIndex, queue, shuffle, repeat, audioElement, goTo]
  );

  const playNext = useCallback(() => advance(false), [advance]);

  const playPrev = useCallback(() => {
    // Standard player behavior: past the first few seconds, restart the track.
    if (audioElement.currentTime > 3) {
      audioElement.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    if (shuffle) {
      // Walk back through what actually played, skipping removed songs.
      while (historyRef.current.length > 0) {
        const id = historyRef.current.pop()!;
        const index = queue.findIndex((s) => s.id === id);
        if (index >= 0) {
          goTo(index, queue, false);
          return;
        }
      }
      audioElement.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    const prevIndex = currentIndex - 1;
    if (prevIndex < 0) return;
    goTo(prevIndex, queue, false);
  }, [queue, currentIndex, shuffle, audioElement, goTo]);

  const seekTo = useCallback(
    (time: number) => {
      audioElement.currentTime = time;
      setCurrentTime(time);
    },
    [audioElement]
  );

  const changeVolume = useCallback(
    (value: number) => {
      const clamped = Math.min(1, Math.max(0, value));
      setVolumeState(clamped);
      audioElement.volume = clamped;
      writeStored("volume", clamped);
      // Raising the volume is an obvious request to hear something.
      if (clamped > 0) {
        setMuted(false);
        audioElement.muted = false;
      }
    },
    [audioElement]
  );

  const toggleMute = useCallback(() => {
    if (muted) {
      // Unmuting while the slider sits at zero would still be silent.
      if (volume === 0) {
        setVolumeState(0.5);
        audioElement.volume = 0.5;
        writeStored("volume", 0.5);
      }
      setMuted(false);
      audioElement.muted = false;
    } else {
      setMuted(true);
      audioElement.muted = true;
    }
  }, [muted, volume, audioElement]);

  const toggleShuffle = useCallback(() => {
    // Start a clean cycle: the current song counts as already played.
    playedRef.current = new Set(currentSong ? [currentSong.id] : []);
    historyRef.current = [];
    setShuffle(!shuffle);
  }, [shuffle, currentSong]);

  const cycleRepeat = useCallback(() => {
    setRepeat((mode) => (mode === "off" ? "all" : mode === "all" ? "one" : "off"));
  }, []);

  const setEqEnabled = useCallback((enabled: boolean) => {
    setEqEnabledState(enabled);
  }, []);

  const setEqBand = useCallback((index: number, gain: number) => {
    if (index < 0 || index >= EQ_BAND_COUNT) return;
    setEqGainsState((prev) => {
      const next = [...prev];
      next[index] = clampGain(gain);
      return next;
    });
  }, []);

  const setEqGains = useCallback((gains: number[]) => {
    if (gains.length !== EQ_BAND_COUNT) return;
    setEqGainsState(gains.map(clampGain));
  }, []);

  const forgetSong = useCallback(
    (id: string) => {
      const keptQueue = queue.filter((s) => s.id !== id);
      if (keptQueue.length === queue.length) return;
      playedRef.current.delete(id);
      historyRef.current = historyRef.current.filter((h) => h !== id);

      if (currentSong?.id === id) {
        stopPlayback();
        setQueue(keptQueue);
        setCurrentIndex(-1);
        return;
      }
      const keptBeforeCurrent =
        currentIndex < 0
          ? -1
          : queue.slice(0, currentIndex).filter((s) => s.id !== id).length;
      setQueue(keptQueue);
      setCurrentIndex(keptBeforeCurrent);
    },
    [queue, currentIndex, currentSong, stopPlayback]
  );

  const syncSong = useCallback((song: Song) => {
    setQueue((prev) => prev.map((s) => (s.id === song.id ? song : s)));
  }, []);

  const getAnalyser = useCallback(() => analyserRef.current, []);

  // Native <audio> events are registered once; 'ended' reads the latest
  // advance through a ref so it never acts on a stale queue.
  const advanceRef = useRef(advance);
  useEffect(() => {
    advanceRef.current = advance;
  }, [advance]);

  // Apply and persist equalizer, shuffle and repeat changes.
  useEffect(() => {
    eqStateRef.current = { gains: eqGains, enabled: eqEnabled };
    equalizerRef.current?.apply(eqGains, eqEnabled);
    writeStored("eqEnabled", eqEnabled);
    writeStored("eqGains", eqGains);
  }, [eqGains, eqEnabled]);
  useEffect(() => writeStored("shuffle", shuffle), [shuffle]);
  useEffect(() => writeStored("repeat", repeat), [repeat]);

  useEffect(() => {
    const handleTimeUpdate = () => setCurrentTime(audioElement.currentTime);
    const handleLoadedMetadata = () => {
      if (Number.isFinite(audioElement.duration)) {
        setDuration(audioElement.duration);
      }
    };
    const handleEnded = () => advanceRef.current(true);
    const handleWaiting = () => setIsBuffering(true);
    const handlePlaying = () => setIsBuffering(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleError = () => {
      // Clearing the src (on stop) also raises an error event; ignore that case.
      if (!audioElement.getAttribute("src")) return;
      setError("Playback failed. The link may have expired; press play to retry.");
      setIsBuffering(false);
    };

    audioElement.addEventListener("timeupdate", handleTimeUpdate);
    audioElement.addEventListener("loadedmetadata", handleLoadedMetadata);
    audioElement.addEventListener("ended", handleEnded);
    audioElement.addEventListener("waiting", handleWaiting);
    audioElement.addEventListener("playing", handlePlaying);
    audioElement.addEventListener("play", handlePlay);
    audioElement.addEventListener("pause", handlePause);
    audioElement.addEventListener("error", handleError);
    return () => {
      audioElement.removeEventListener("timeupdate", handleTimeUpdate);
      audioElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audioElement.removeEventListener("ended", handleEnded);
      audioElement.removeEventListener("waiting", handleWaiting);
      audioElement.removeEventListener("playing", handlePlaying);
      audioElement.removeEventListener("play", handlePlay);
      audioElement.removeEventListener("pause", handlePause);
      audioElement.removeEventListener("error", handleError);
    };
  }, [audioElement]);

  // On unmount (e.g. sign-out) stop the sound and release the audio context.
  useEffect(() => {
    return () => {
      audioElement.pause();
      audioElement.removeAttribute("src");
      audioElement.load();
      void audioContextRef.current?.close();
      audioContextRef.current = null;
      analyserRef.current = null;
      equalizerRef.current = null;
    };
  }, [audioElement]);

  // Keyboard: Space play/pause, arrows seek 5 s, M mutes. Ignored while the
  // person is typing, on a control that uses these keys itself, or in a dialog.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat && e.code === "Space") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (!["Space", "ArrowLeft", "ArrowRight", "KeyM"].includes(e.code)) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(
          'input, textarea, select, button, a, [role="slider"], [contenteditable="true"]'
        )
      ) {
        return;
      }
      if (document.querySelector("dialog[open]")) return;

      if (e.code === "Space") {
        e.preventDefault();
        void togglePlayPause();
      } else if (e.code === "KeyM") {
        toggleMute();
      } else if (currentSong && audioElement.getAttribute("src")) {
        e.preventDefault();
        const delta = e.code === "ArrowRight" ? 5 : -5;
        const limit = Number.isFinite(audioElement.duration)
          ? audioElement.duration
          : Infinity;
        const time = Math.min(limit, Math.max(0, audioElement.currentTime + delta));
        audioElement.currentTime = time;
        setCurrentTime(time);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlayPause, toggleMute, currentSong, audioElement]);

  // Lock-screen / hardware media key integration.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;

    if (currentSong) {
      session.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.artist ?? "",
        album: currentSong.album ?? "",
      });
    } else {
      session.metadata = null;
    }

    session.setActionHandler("play", () => {
      void audioElement.play().catch(() => undefined);
    });
    session.setActionHandler("pause", () => audioElement.pause());
    session.setActionHandler("nexttrack", playNext);
    session.setActionHandler("previoustrack", playPrev);
    return () => {
      session.setActionHandler("play", null);
      session.setActionHandler("pause", null);
      session.setActionHandler("nexttrack", null);
      session.setActionHandler("previoustrack", null);
    };
  }, [currentSong, audioElement, playNext, playPrev]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      queue,
      currentIndex,
      currentSong,
      isPlaying,
      isBuffering,
      volume,
      muted,
      shuffle,
      repeat,
      eqEnabled,
      eqGains,
      error,
      playQueue,
      jumpTo,
      addToQueue,
      togglePlayPause,
      playNext,
      playPrev,
      seekTo,
      changeVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      setEqEnabled,
      setEqBand,
      setEqGains,
      forgetSong,
      syncSong,
      getAnalyser,
    }),
    [
      queue,
      currentIndex,
      currentSong,
      isPlaying,
      isBuffering,
      volume,
      muted,
      shuffle,
      repeat,
      eqEnabled,
      eqGains,
      error,
      playQueue,
      jumpTo,
      addToQueue,
      togglePlayPause,
      playNext,
      playPrev,
      seekTo,
      changeVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      setEqEnabled,
      setEqBand,
      setEqGains,
      forgetSong,
      syncSong,
      getAnalyser,
    ]
  );

  const timeValue = useMemo<PlayerTimeValue>(
    () => ({ currentTime, duration }),
    [currentTime, duration]
  );

  return (
    <PlayerContext.Provider value={value}>
      <PlayerTimeContext.Provider value={timeValue}>
        {children}
      </PlayerTimeContext.Provider>
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}

export function usePlayerTime() {
  const ctx = useContext(PlayerTimeContext);
  if (!ctx) throw new Error("usePlayerTime must be used inside <PlayerProvider>");
  return ctx;
}
