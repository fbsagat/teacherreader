/**
 * Returns the user's LOCAL calendar day as `YYYY-MM-DD`.
 *
 * Never use `new Date().toISOString().slice(0, 10)` for "today": that is UTC,
 * so in Brazil (UTC-3) the day flips at 21:00 and the streak / daily goal /
 * history chart end up on the wrong day.
 */
export function localDayKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parses a `YYYY-MM-DD` key as a LOCAL date (not UTC). Returns null when invalid. */
export function parseLocalDayKey(key: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Number of whole calendar days between two local day keys (b - a). */
export function localDayDiff(a: string, b: string): number {
  const dateA = parseLocalDayKey(a);
  const dateB = parseLocalDayKey(b);
  if (!dateA || !dateB) return 0;
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((dateB.getTime() - dateA.getTime()) / MS_PER_DAY);
}
