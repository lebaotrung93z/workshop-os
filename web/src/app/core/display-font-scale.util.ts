/** Big-screen content scale relative to the default (1 = medium). */
export const DISPLAY_FONT_SCALE_PRESETS = [
  { value: 0.85, label: 'S', title: 'Small' },
  { value: 1, label: 'M', title: 'Medium' },
  { value: 1.2, label: 'L', title: 'Large' },
  { value: 1.45, label: 'XL', title: 'Extra large' }
] as const;

export const DEFAULT_DISPLAY_FONT_SCALE = 1;

export function clampDisplayFontScale(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_DISPLAY_FONT_SCALE;
  return Math.min(1.8, Math.max(0.7, Math.round(n * 100) / 100));
}

export function nearestDisplayFontPreset(raw: unknown): number {
  const scale = clampDisplayFontScale(raw);
  let best = DEFAULT_DISPLAY_FONT_SCALE;
  let bestDist = Infinity;
  for (const p of DISPLAY_FONT_SCALE_PRESETS) {
    const d = Math.abs(p.value - scale);
    if (d < bestDist) {
      bestDist = d;
      best = p.value;
    }
  }
  return best;
}
