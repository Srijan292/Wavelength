export const EQ_MIN_GAIN = -12;
export const EQ_MAX_GAIN = 12;

export interface EqBand {
  freq: number;
  type: BiquadFilterType;
  label: string;
}

// Ten bands, one octave apart. The outer two are shelves so the extremes lift
// or cut everything beyond them; the rest are peaking filters whose Q (about
// 1.1) makes neighbouring bands overlap smoothly.
export const EQ_BANDS: EqBand[] = [
  { freq: 31, type: "lowshelf", label: "31" },
  { freq: 62, type: "peaking", label: "62" },
  { freq: 125, type: "peaking", label: "125" },
  { freq: 250, type: "peaking", label: "250" },
  { freq: 500, type: "peaking", label: "500" },
  { freq: 1000, type: "peaking", label: "1k" },
  { freq: 2000, type: "peaking", label: "2k" },
  { freq: 4000, type: "peaking", label: "4k" },
  { freq: 8000, type: "peaking", label: "8k" },
  { freq: 16000, type: "highshelf", label: "16k" },
];

export const EQ_BAND_COUNT = EQ_BANDS.length;
const PEAKING_Q = 1.1;

export const EQ_PRESETS: { name: string; gains: number[] }[] = [
  { name: "Flat", gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: "Bass boost", gains: [6, 5, 4, 2, 1, 0, 0, 0, 0, 0] },
  { name: "Treble boost", gains: [0, 0, 0, 0, 0, 1, 2, 4, 5, 6] },
  { name: "Vocal", gains: [-2, -2, -1, 1, 3, 3, 2, 1, 0, -1] },
  { name: "Electronic", gains: [5, 4, 1, 0, -2, 2, 1, 2, 4, 5] },
  { name: "Acoustic", gains: [4, 4, 3, 1, 1, 1, 3, 3, 3, 2] },
];

export const FLAT_GAINS: number[] = EQ_PRESETS[0].gains;

export function clampGain(value: number): number {
  return Math.min(EQ_MAX_GAIN, Math.max(EQ_MIN_GAIN, value));
}

export function isGainList(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === EQ_BAND_COUNT &&
    value.every(
      (g) => typeof g === "number" && g >= EQ_MIN_GAIN && g <= EQ_MAX_GAIN
    )
  );
}

/** How much quieter the output must be so the loudest boost cannot clip. */
export function headroomDb(gains: number[]): number {
  return Math.max(0, ...gains);
}

export interface Equalizer {
  input: AudioNode;
  output: AudioNode;
  apply: (gains: number[], enabled: boolean) => void;
}

/**
 * source -> 10 BiquadFilterNodes in series -> headroom gain.
 * Bypassing sets every band to 0 dB and the headroom to unity, so the signal
 * passes through unchanged without rewiring the graph.
 */
export function createEqualizer(
  context: AudioContext,
  gains: number[],
  enabled: boolean
): Equalizer {
  const filters = EQ_BANDS.map((band) => {
    const filter = context.createBiquadFilter();
    filter.type = band.type;
    filter.frequency.value = band.freq;
    if (band.type === "peaking") filter.Q.value = PEAKING_Q;
    filter.gain.value = 0;
    return filter;
  });
  filters.forEach((filter, i) => {
    if (i > 0) filters[i - 1].connect(filter);
  });

  const headroom = context.createGain();
  filters[filters.length - 1].connect(headroom);

  const SMOOTHING = 0.015; // seconds; avoids clicks when a slider moves
  const apply = (nextGains: number[], isEnabled: boolean) => {
    const now = context.currentTime;
    filters.forEach((filter, i) => {
      const target = isEnabled ? nextGains[i] : 0;
      filter.gain.setTargetAtTime(target, now, SMOOTHING);
    });
    const headroomGain = isEnabled
      ? Math.pow(10, -headroomDb(nextGains) / 20)
      : 1;
    headroom.gain.setTargetAtTime(headroomGain, now, SMOOTHING);
  };

  // Initial values are set directly (no ramp) so the first note is correct.
  filters.forEach((filter, i) => {
    filter.gain.value = enabled ? gains[i] : 0;
  });
  headroom.gain.value = enabled ? Math.pow(10, -headroomDb(gains) / 20) : 1;

  return { input: filters[0], output: headroom, apply };
}
