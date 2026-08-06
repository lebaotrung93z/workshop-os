/** Live workshop countdown helpers (session root fields). */

export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

/** Remaining seconds from session timer fields, or null if no active/paused timer. */
export function remainingSeconds(session: any, nowMs = Date.now()): number | null {
  if (!session) return null;
  const paused = session.timerPausedRemaining;
  if (paused != null && Number.isFinite(Number(paused))) {
    return Math.max(0, Math.floor(Number(paused)));
  }
  const endsAt = session.timerEndsAt;
  if (!endsAt) return null;
  const end = Date.parse(String(endsAt));
  if (!Number.isFinite(end)) return null;
  return Math.max(0, Math.floor((end - nowMs) / 1000));
}

export function isTimerPaused(session: any): boolean {
  return session?.timerPausedRemaining != null && !session?.timerEndsAt;
}

export function isTimerRunning(session: any): boolean {
  return !!session?.timerEndsAt;
}

export function hasTimer(session: any): boolean {
  return isTimerRunning(session) || isTimerPaused(session);
}

export function stepTimerSeconds(session: any): number {
  const raw = Number(session?.currentStep?.timerSeconds);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

export function clearTimerPatch() {
  return { timerEndsAt: null, timerPausedRemaining: null };
}
