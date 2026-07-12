/**
 * Server-side local-date helpers (mirrors src/lib/dates.ts on the frontend).
 *
 * `Date#toISOString()` always renders in UTC, so for UTC+ timezones (this
 * app targets Australia) slicing the date out of an ISO string resolves to
 * "yesterday" for part of the day. These helpers work in local time instead.
 * Never parse a date-only 'YYYY-MM-DD' string with `new Date(str)` — that
 * parses as UTC midnight and can shift the date by a day depending on the
 * server's local timezone.
 */

/** Format a Date as YYYY-MM-DD using its *local* date parts. */
export function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Today's date as YYYY-MM-DD in local time. */
export function todayLocalDate(): string {
  return formatLocalDate(new Date());
}

/**
 * Human-readable date for display (e.g. "12 July 2026"), parsed from a
 * 'YYYY-MM-DD' string by splitting into parts — never `new Date(str)`.
 */
export function formatDisplayDate(s: string, locale = 'en-AU'): string {
  const [year, month, day] = s.slice(0, 10).split('-').map(Number);
  const d = new Date(year, (month || 1) - 1, day || 1);
  try {
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
