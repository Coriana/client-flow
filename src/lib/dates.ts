/**
 * Local-date helpers.
 *
 * `Date#toISOString()` always renders in UTC, so for UTC+ timezones (this app
 * targets Australia) slicing the date out of an ISO string resolves to
 * "yesterday" for part of the day. These helpers work in local time instead.
 */

/** Format a Date as YYYY-MM-DD using its *local* date parts. */
export function formatDateOnly(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Today's date as YYYY-MM-DD in local time. */
export function todayLocal(): string {
  return formatDateOnly(new Date());
}

/**
 * Parse a 'YYYY-MM-DD' string into a local Date (midnight local time).
 * Do NOT use `new Date(s)` for date-only strings — that parses as UTC and
 * can shift the date by a day depending on the local timezone.
 */
export function parseDateOnly(s: string): Date {
  const [year, month, day] = s.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Return a new Date offset by `days` (local arithmetic; handles month/year rollover). */
export function addDays(d: Date, days: number): Date {
  const result = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  result.setDate(result.getDate() + days);
  return result;
}

/** Human-readable date for display (localized), from a YYYY-MM-DD string. */
export function formatDisplayDate(s: string | null | undefined): string {
  if (!s) return '-';
  return parseDateOnly(s.slice(0, 10)).toLocaleDateString();
}
