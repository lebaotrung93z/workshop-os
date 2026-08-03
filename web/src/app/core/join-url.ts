/** Scan-friendly join link (no hash). Root `/?code=` always hits index.html on static hosting. */
export function buildJoinUrl(origin: string, code: string): string {
  const trimmed = (code || '').trim().toUpperCase();
  const base = origin.replace(/\/$/, '');
  return trimmed ? `${base}/?code=${encodeURIComponent(trimmed)}` : `${base}/?code=`;
}

/** Read workshop code from either `?code=` (scan URL) or hash query `/#/j?code=`. */
export function readJoinCodeFromLocation(loc: Location = location): string {
  const fromSearch = new URLSearchParams(loc.search).get('code');
  if (fromSearch) return fromSearch.trim().toUpperCase();

  const hash = loc.hash || '';
  const q = hash.indexOf('?');
  if (q >= 0) {
    const fromHash = new URLSearchParams(hash.slice(q + 1)).get('code');
    if (fromHash) return fromHash.trim().toUpperCase();
  }
  return '';
}
