import { useEffect, useRef } from "react";
import { usePlayer } from "../../context/PlayerContext";

const BAR_WIDTH = 4;
const BAR_GAP = 3;
const MIN_FREQ = 45; // Hz, around the lowest bass notes
const MAX_FREQ = 14000; // Hz, above this there is little musical energy
const MIN_BAR_HEIGHT = 2;

/**
 * A live frequency display driven by the player's AnalyserNode. It is the one
 * place the accent color is used at scale, and only while audio is playing.
 */
export function Spectrum() {
  const { isPlaying, getAnalyser } = usePlayer();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const styles = getComputedStyle(canvas);
    const activeColor = styles.getPropertyValue("--accent").trim() || "#D9A441";
    const idleColor =
      styles.getPropertyValue("--border-strong").trim() || "#3A3F4D";

    let width = 0;
    let height = 0;
    let levels: number[] = [];
    let frame = 0;
    let data = new Uint8Array(0);

    const barCount = () =>
      Math.max(1, Math.floor((width + BAR_GAP) / (BAR_WIDTH + BAR_GAP)));

    const draw = (targets: number[] | null) => {
      context.clearRect(0, 0, width, height);
      let anyActive = false;
      for (let i = 0; i < levels.length; i++) {
        const target = targets ? targets[i] : 0;
        // Rise quickly, fall slowly, so bars feel weighted rather than jittery.
        levels[i] += (target - levels[i]) * (target > levels[i] ? 0.5 : 0.12);
        if (levels[i] < 0.004) levels[i] = 0;
        const active = levels[i] > 0.02;
        anyActive = anyActive || active;

        const barHeight = Math.max(MIN_BAR_HEIGHT, levels[i] * height);
        context.fillStyle = active ? activeColor : idleColor;
        context.beginPath();
        context.roundRect(
          i * (BAR_WIDTH + BAR_GAP),
          height - barHeight,
          BAR_WIDTH,
          barHeight,
          2
        );
        context.fill();
      }
      return anyActive;
    };

    const readTargets = (): number[] | null => {
      const analyser = getAnalyser();
      if (!analyser) return null;
      if (data.length !== analyser.frequencyBinCount) {
        data = new Uint8Array(analyser.frequencyBinCount);
      }
      analyser.getByteFrequencyData(data);

      const hzPerBin = analyser.context.sampleRate / analyser.fftSize;
      const n = levels.length;
      // Log-spaced band edges, so bass and treble get comparable room on screen.
      const edge = (i: number) => MIN_FREQ * Math.pow(MAX_FREQ / MIN_FREQ, i / n);
      const targets: number[] = new Array<number>(n);
      for (let i = 0; i < n; i++) {
        const lo = Math.max(1, Math.floor(edge(i) / hzPerBin));
        const hi = Math.min(data.length, Math.max(lo + 1, Math.ceil(edge(i + 1) / hzPerBin)));
        let peak = 0;
        for (let bin = lo; bin < hi; bin++) peak = Math.max(peak, data[bin]);
        // Music carries less energy up high; a gentle tilt keeps the right side alive.
        const tilt = 0.8 + 0.5 * (n === 1 ? 0 : i / (n - 1));
        targets[i] = Math.min(1, Math.pow(peak / 255, 1.4) * tilt);
      }
      return targets;
    };

    const loop = () => {
      const stillMoving = draw(isPlaying ? readTargets() : null);
      if (isPlaying || stillMoving) frame = requestAnimationFrame(loop);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = barCount();
      levels = new Array<number>(count).fill(0);
      cancelAnimationFrame(frame);
      if (reduceMotion) {
        draw(null);
      } else {
        loop();
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [isPlaying, getAnalyser]);

  return <canvas ref={canvasRef} className="spectrum" aria-hidden="true" />;
}
