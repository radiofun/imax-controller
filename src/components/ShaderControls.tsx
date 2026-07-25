"use client";

import {
  CRT_SLIDERS,
  DEFAULT_CRT,
  type CrtSettings,
} from "@/lib/crtSettings";

type Props = {
  settings: CrtSettings;
  onChange: (next: CrtSettings) => void;
};

export default function ShaderControls({ settings, onChange }: Props) {
  return (
    <aside className="shader-controls" aria-label="CRT shader controls">
      <div className="shader-controls-title">CRT SHADER</div>
      {CRT_SLIDERS.map(({ key, label, min, max, step }) => (
        <label key={key} className="shader-slider">
          <span className="shader-slider-label">
            <span>{label}</span>
            <span className="shader-slider-val">
              {settings[key].toFixed(2)}
            </span>
          </span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={settings[key]}
            onChange={(e) =>
              onChange({ ...settings, [key]: Number(e.target.value) })
            }
          />
        </label>
      ))}
      <button
        type="button"
        className="shader-reset"
        onClick={() => onChange({ ...DEFAULT_CRT })}
      >
        Reset
      </button>
    </aside>
  );
}
