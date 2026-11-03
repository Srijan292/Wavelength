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

interface PlayerContextValue {
  queue: Song[];
  currentIndex: number;
  currentSong: Song | null;
  isPlaying: boolean;
  isBuffering: boolean;
  volume: number;
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
    return audio;
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  // Bumped on every load request and on stop, so a slow response for an
  // earlier track can never overwrite a newer one.
  const loadTokenRef = useRef(0);

  const [queue, setQueue] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const currentSong = currentIndex >= 0 ? (queue[currentIndex] ?? null) : null;

  // Builds the Web Audio graph once, on first playback (which always follows a
  // user gesture, so the context isn't left suspended by autoplay rules):
  //   <audio> -> source -> analyser -> gain -> speakers
  // Phase 3's equalizer inserts a chain of BiquadFilterNodes between the
  // analyser and the gain. Volume uses audio.volume, not the gain node, so the
  // two never double-attenuate.
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

    source.connect(analyser);
    analyser.connect(gain);
    gain.connect(context.destination);

    audioContextRef.current = context;
    analyserRef.current = analyser;
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

  const playQueue = useCallback(
    (songsToPlay: Song[], startIndex: number) => {
      const target = songsToPlay[startIndex];
      if (!target) return;
      setQueue(songsToPlay);
      setCurrentIndex(startIndex);
      void loadSongAndPlay(target);
    },
    [loadSongAndPlay]
  );

  const jumpTo = useCallback(
    (index: number) => {
      const target = queue[index];
      if (!target) return;
      setCurrentIndex(index);
      void loadSongAndPlay(target);
    },
    [queue, loadSongAndPlay]
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

  const playNext = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length) {
      audioElement.pause();
      return;
    }
    setCurrentIndex(nextIndex);
    void loadSongAndPlay(queue[nextIndex]);
  }, [queue, currentIndex, audioElement, loadSongAndPlay]);

  const playPrev = useCallback(() => {
    // Standard player behavior: past the first few seconds, restart the track.
    if (audioElement.currentTime > 3) {
      audioElement.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    const prevIndex = currentIndex - 1;
    if (prevIndex < 0) return;
    setCurrentIndex(prevIndex);
    void loadSongAndPlay(queue[prevIndex]);
  }, [queue, currentIndex, audioElement, loadSongAndPlay]);

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
    },
    [audioElement]
  );

  const forgetSong = useCallback(
    (id: string) => {
      const keptQueue = queue.filter((s) => s.id !== id);
      if (keptQueue.length === queue.length) return;

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
  // playNext through a ref so it never acts on a stale queue.
  const playNextRef = useRef(playNext);
  useEffect(() => {
    playNextRef.current = playNext;
  }, [playNext]);

  useEffect(() => {
    const handleTimeUpdate = () => setCurrentTime(audioElement.currentTime);
    const handleLoadedMetadata = () => {
      if (Number.isFinite(audioElement.duration)) {
        setDuration(audioElement.duration);
      }
    };
    const handleEnded = () => playNextRef.current();
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
    };
  }, [audioElement]);

  // Space toggles play/pause, unless the person is typing or on a control
  // that already uses Space.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, button, a, [contenteditable="true"]')) {
        return;
      }
      e.preventDefault();
      void togglePlayPause();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlayPause]);

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
      error,
      playQueue,
      jumpTo,
      addToQueue,
      togglePlayPause,
      playNext,
      playPrev,
      seekTo,
      changeVolume,
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
      error,
      playQueue,
      jumpTo,
      addToQueue,
      togglePlayPause,
      playNext,
      playPrev,
      seekTo,
      changeVolume,
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
