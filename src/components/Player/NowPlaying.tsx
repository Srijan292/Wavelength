import { usePlayer } from "../../context/PlayerContext";
import { Spectrum } from "./Spectrum";

export function NowPlaying() {
  const { currentSong } = usePlayer();

  return (
    <section className="stage" aria-label="Now playing">
      <h1 className={currentSong ? "stage__title" : "stage__title stage__title--idle"}>
        {currentSong ? currentSong.title : "Nothing playing"}
      </h1>
      <p className="stage__subtitle">
        {currentSong
          ? [currentSong.artist || "Unknown artist", currentSong.album]
              .filter(Boolean)
              .join(", ")
          : "Pick a song from your library to start listening."}
      </p>
      <Spectrum />
    </section>
  );
}
