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
 * Scale so the selected rect fills as much of the viewport as possible.
 * Uses the limiting axis so the full selection stays visible.
 */
export function focusScale(focus: DisplayFocusRect, fill = 0.98): number {
  const sx = 100 / Math.max(focus.w, 0.5);
  const sy = 100 / Math.max(focus.h, 0.5);
  return Math.max(1, Math.min(sx, sy) * fill);
}
