export type CrtSettings = {
  vignette: number;
  bloom: number;
  scanlines: number;
  grille: number;
  flicker: number;
  noise: number;
  curvature: number;
  /** 1 = sharp full-res, lower = chunkier CRT */
  resolution: number;
};

export const DEFAULT_CRT: CrtSettings = {
  vignette: 0.25,
  bloom: 1.8,
  scanlines: 0.55,
  grille: 0.35,
  flicker: 0.35,
  noise: 0.25,
  curvature: 0.14,
  resolution: 0.56,
};

export const CRT_SLIDERS: {
  key: keyof CrtSettings;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: "bloom", label: "Bloom", min: 0, max: 2.5, step: 0.05 },
  { key: "vignette", label: "Vignette", min: 0, max: 1.5, step: 0.05 },
  { key: "scanlines", label: "Scanlines", min: 0, max: 1, step: 0.05 },
  { key: "grille", label: "Aperture Grille", min: 0, max: 1, step: 0.05 },
  { key: "curvature", label: "Curvature", min: 0, max: 1.5, step: 0.01 },
  { key: "resolution", label: "Resolution", min: 0.3, max: 1, step: 0.02 },
  { key: "flicker", label: "Flicker", min: 0, max: 1, step: 0.05 },
  { key: "noise", label: "Noise", min: 0, max: 1, step: 0.05 },
];
