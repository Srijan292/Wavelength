import type { CSSProperties } from "react";
import { usePlayer } from "../../context/PlayerContext";
import {
  EQ_BANDS,
  EQ_MAX_GAIN,
  EQ_MIN_GAIN,
  EQ_PRESETS,
  FLAT_GAINS,
  headroomDb,
} from "../../lib/audio/equalizer";
import { Drawer } from "./Drawer";

interface EqualizerPanelProps {
  open: boolean;
  onClose: () => void;
}

const CURVE_W = 300;
const CURVE_H = 84;
const CURVE_PAD = 8;

function formatGain(gain: number): string {
  const rounded = Math.round(gain * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}`;
}

/** Draws the response through the band gains as a smooth Catmull-Rom curve. */
function curvePath(gains: number[]): { line: string; points: { x: number; y: number }[] } {
  const points = gains.map((gain, i) => ({
    x: CURVE_PAD + (i / (gains.length - 1)) * (CURVE_W - CURVE_PAD * 2),
    y: CURVE_H / 2 - (gain / EQ_MAX_GAIN) * (CURVE_H / 2 - CURVE_PAD),
  }));
  let line = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    line += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return { line, points };
}

function sliderStyle(gain: number): CSSProperties {
  // The fill runs from the centre (0 dB) to the handle, not from the left edge.
  const percent = ((gain - EQ_MIN_GAIN) / (EQ_MAX_GAIN - EQ_MIN_GAIN)) * 100;
  return {
    "--lo": `${Math.min(50, percent)}%`,
    "--hi": `${Math.max(50, percent)}%`,
  } as CSSProperties;
}

export function EqualizerPanel({ open, onClose }: EqualizerPanelProps) {
  const { eqEnabled, eqGains, setEqEnabled, setEqBand, setEqGains } = usePlayer();
  const { line, points } = curvePath(eqGains);
  const boost = headroomDb(eqGains);

  // Touching any control turns the equalizer on: moving a slider that has no
  // audible effect would just look broken.
  const enableIfOff = () => {
    if (!eqEnabled) setEqEnabled(true);
  };

  const activePreset = EQ_PRESETS.find((preset) =>
    preset.gains.every((gain, i) => gain === eqGains[i])
  );

  const toggle = (
    <button
      type="button"
      role="switch"
      aria-checked={eqEnabled}
      aria-label="Enable equalizer"
      className={eqEnabled ? "switch switch--on" : "switch"}
      onClick={() => setEqEnabled(!eqEnabled)}
    >
      <span className="switch__knob" />
    </button>
  );

  return (
    <Drawer
      open={open}
      title="Equalizer"
      subtitle={eqEnabled ? "On" : "Off"}
      actions={toggle}
      onClose={onClose}
    >
      <div className={eqEnabled ? "eq" : "eq eq--off"}>
        <div className="eq__presets" role="group" aria-label="Presets">
          {EQ_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className={
                eqEnabled && activePreset?.name === preset.name
                  ? "chip chip--on"
                  : "chip"
              }
              aria-pressed={eqEnabled && activePreset?.name === preset.name}
              onClick={() => {
                enableIfOff();
                setEqGains(preset.gains);
              }}
            >
              {preset.name}
            </button>
          ))}
        </div>

        <svg
          className="eq__curve"
          viewBox={`0 0 ${CURVE_W} ${CURVE_H}`}
          role="img"
          aria-label="Frequency response"
          preserveAspectRatio="none"
        >
          <line
            x1={0}
            x2={CURVE_W}
            y1={CURVE_H / 2}
            y2={CURVE_H / 2}
            className="eq__curve-zero"
          />
          <path d={line} className="eq__curve-line" />
          {points.map((point, i) => (
            <circle key={EQ_BANDS[i].freq} cx={point.x} cy={point.y} r={2.5} className="eq__curve-dot" />
          ))}
        </svg>

        <div className="eq__bands">
          {EQ_BANDS.map((band, i) => (
            <div key={band.freq} className="eq__band">
              <span className="eq__freq">{band.label}</span>
              <input
                type="range"
                className="range range--eq"
                style={sliderStyle(eqGains[i])}
                min={EQ_MIN_GAIN}
                max={EQ_MAX_GAIN}
                step={0.5}
                value={eqGains[i]}
                onChange={(e) => {
                  enableIfOff();
                  setEqBand(i, Number(e.target.value));
                }}
                onDoubleClick={() => setEqBand(i, 0)}
                aria-label={`${band.label} Hz`}
                aria-valuetext={`${formatGain(eqGains[i])} dB`}
              />
              <span className="eq__gain">{formatGain(eqGains[i])}</span>
            </div>
          ))}
        </div>

        <div className="eq__footer">
          <p className="eq__note">
            {eqEnabled && boost > 0
              ? `Output is lowered by ${boost.toFixed(1)} dB so boosted bands can’t clip.`
              : "Double-click a slider to reset that band."}
          </p>
          <button
            type="button"
            className="btn-text"
            onClick={() => setEqGains(FLAT_GAINS)}
            disabled={eqGains.every((gain) => gain === 0)}
          >
            Reset
          </button>
        </div>
      </div>
    </Drawer>
  );
}
