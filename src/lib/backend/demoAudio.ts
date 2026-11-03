// Synthesizes a few short instrumental tracks in the browser so demo mode has
// real, playable audio without shipping any audio files.

const SAMPLE_RATE = 22050;

interface TrackSpec {
  title: string;
  bpm: number;
  stepBeats: number; // length of one note step, in beats
  steps: number;
  notes: number[]; // Hz, 0 = rest; cycles over the steps
  pad: number[]; // Hz, slow sustained tones under the notes
}

// Equal-tempered note frequencies used below.
const A2 = 110.0;
const E3 = 164.81;
const A3 = 220.0;
const C4 = 261.63;
const D4 = 293.66;
const E4 = 329.63;
const G4 = 392.0;
const A4 = 440.0;
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;

const TRACKS: TrackSpec[] = [
  {
    title: "Open Frequency",
    bpm: 96,
    stepBeats: 0.5,
    steps: 44,
    notes: [A3, C4, E4, A4, E4, C4, A3, 0, D4, G4, C5, G4],
    pad: [A2, E3],
  },
  {
    title: "Slow Carrier",
    bpm: 60,
    stepBeats: 1,
    steps: 28,
    notes: [E4, 0, A4, 0, G4, 0, D4, 0, C4, 0, E4, 0],
    pad: [A2, A3],
  },
  {
    title: "Standing Wave",
    bpm: 120,
    stepBeats: 0.5,
    steps: 52,
    notes: [A3, A3, E4, A3, G4, A3, E4, D4, C5, A4, E5, D5],
    pad: [A2],
  },
];

function render(spec: TrackSpec): { samples: Float32Array; duration: number } {
  const stepSeconds = (60 / spec.bpm) * spec.stepBeats;
  const tail = 1.6;
  const duration = spec.steps * stepSeconds + tail;
  const samples = new Float32Array(Math.floor(duration * SAMPLE_RATE));

  // Plucked notes: a few harmonics under a fast exponential decay.
  for (let step = 0; step < spec.steps; step++) {
    const freq = spec.notes[step % spec.notes.length];
    if (freq === 0) continue;
    const start = Math.floor(step * stepSeconds * SAMPLE_RATE);
    const length = Math.min(Math.floor(1.5 * SAMPLE_RATE), samples.length - start);
    for (let i = 0; i < length; i++) {
      const t = i / SAMPLE_RATE;
      const envelope = Math.exp(-3.4 * t) * Math.min(1, i / 120); // 120-sample attack avoids clicks
      const w = 2 * Math.PI * freq * t;
      samples[start + i] +=
        envelope * (Math.sin(w) + 0.4 * Math.sin(2 * w) + 0.18 * Math.sin(3 * w)) * 0.3;
    }
  }

  // Pad: slow sustained tones with a gentle swell.
  for (const freq of spec.pad) {
    for (let i = 0; i < samples.length; i++) {
      const t = i / SAMPLE_RATE;
      const swell = 0.6 + 0.4 * Math.sin(2 * Math.PI * 0.12 * t);
      samples[i] += 0.07 * swell * Math.sin(2 * Math.PI * freq * t);
    }
  }

  // Normalize, then fade the very start and end so playback never clicks.
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  const gain = peak > 0 ? 0.8 / peak : 1;
  const fade = Math.floor(0.6 * SAMPLE_RATE);
  for (let i = 0; i < samples.length; i++) {
    let g = gain;
    if (i < 200) g *= i / 200;
    const fromEnd = samples.length - 1 - i;
    if (fromEnd < fade) g *= fromEnd / fade;
    samples[i] *= g;
  }

  return { samples, duration: samples.length / SAMPLE_RATE };
}

function toWavBlob(samples: Float32Array): Blob {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export interface DemoTrack {
  title: string;
  duration: number;
  url: string;
}

export function synthesizeDemoTracks(): DemoTrack[] {
  return TRACKS.map((spec) => {
    const { samples, duration } = render(spec);
    return {
      title: spec.title,
      duration,
      url: URL.createObjectURL(toWavBlob(samples)),
    };
  });
}
