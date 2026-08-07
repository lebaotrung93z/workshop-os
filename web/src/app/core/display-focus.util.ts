/** Normalized big-screen focus rect (percent of content stage, 0–100). */
export interface DisplayFocusRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function clearDisplayFocusPatch() {
  return { displayFocus: null as DisplayFocusRect | null };
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Normalize a pixel drag within an element into a percent rect. */
export function rectFromDrag(
  el: HTMLElement,
  startX: number,
  startY: number,
  endX: number,
  endY: number
): DisplayFocusRect | null {
  const box = el.getBoundingClientRect();
  if (box.width < 8 || box.height < 8) return null;
  const x1 = ((Math.min(startX, endX) - box.left) / box.width) * 100;
  const y1 = ((Math.min(startY, endY) - box.top) / box.height) * 100;
  const x2 = ((Math.max(startX, endX) - box.left) / box.width) * 100;
  const y2 = ((Math.max(startY, endY) - box.top) / box.height) * 100;
  const x = clamp(x1, 0, 100);
  const y = clamp(y1, 0, 100);
  const w = clamp(x2, 0, 100) - x;
  const h = clamp(y2, 0, 100) - y;
  if (w < 6 || h < 6) return null;
  return {
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    w: Math.round(w * 10) / 10,
    h: Math.round(h * 10) / 10
  };
}

export function isValidDisplayFocus(raw: unknown): raw is DisplayFocusRect {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as DisplayFocusRect;
  return (
    Number.isFinite(r.x) &&
    Number.isFinite(r.y) &&
    Number.isFinite(r.w) &&
    Number.isFinite(r.h) &&
    r.w >= 4 &&
    r.h >= 4
  );
}

/** CSS transform-origin for zooming into a focus rect. */
export function focusOrigin(focus: DisplayFocusRect): string {
  const cx = focus.x + focus.w / 2;
  const cy = focus.y + focus.h / 2;
  return `${clamp(cx, 0, 100)}% ${clamp(cy, 0, 100)}%`;
}

/**
 * Scale so the focus rect fills most of the viewport.
 * Caps at 4× so tiny selections stay readable without extreme blur.
 */
export function focusScale(focus: DisplayFocusRect, padding = 0.9): number {
  const sx = 100 / Math.max(focus.w, 1);
  const sy = 100 / Math.max(focus.h, 1);
  return clamp(Math.min(sx, sy) * padding, 1.05, 4);
}
