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

/**
 * Pixel transform that maps the focus rect to fill the viewport as much as possible.
 * Uses transform-origin (0,0) + translate + scale so tall/wide boards zoom correctly
 * (percent transform-origin alone fails when the stage is larger than the viewport).
 */
export function focusStageTransform(
  focus: DisplayFocusRect,
  viewportW: number,
  viewportH: number,
  stageW: number,
  stageH: number,
  fill = 0.96
): string {
  if (viewportW < 8 || viewportH < 8 || stageW < 8 || stageH < 8) return 'none';

  const fx = (focus.x / 100) * stageW;
  const fy = (focus.y / 100) * stageH;
  const fw = Math.max((focus.w / 100) * stageW, 8);
  const fh = Math.max((focus.h / 100) * stageH, 8);

  const scale = Math.min(viewportW / fw, viewportH / fh) * fill;
  const cx = fx + fw / 2;
  const cy = fy + fh / 2;
  const tx = viewportW / 2 - scale * cx;
  const ty = viewportH / 2 - scale * cy;

  return `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${scale.toFixed(4)})`;
}
