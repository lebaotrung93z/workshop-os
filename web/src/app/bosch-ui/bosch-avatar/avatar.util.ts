/** Two-letter initials from a display name (avatar fallback when no photo). */
export function initialsFromName(name: string | null | undefined): string {
  const parts = (name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic Bosch-palette tint from a name (stable per person). */
export function avatarToneFromName(name: string | null | undefined): string {
  const tones = [
    'var(--bosch-accent)',
    'var(--bosch-turquoise-50)',
    'var(--bosch-green-50)',
    'var(--bosch-purple-40)',
    'var(--bosch-blue-55)',
    'var(--bosch-green-60)'
  ];
  const s = (name || '').trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return tones[Math.abs(hash) % tones.length];
}
