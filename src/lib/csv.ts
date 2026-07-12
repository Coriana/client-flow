/**
 * Minimal CSV helpers shared by the report export buttons.
 *
 * Values are exported raw (numbers as numbers, dates as YYYY-MM-DD strings)
 * rather than pre-formatted for display — callers are responsible for
 * rounding currency/percentage values before handing them to `buildCsv`.
 */

export type CsvValue = string | number | null | undefined;

function needsQuoting(value: string): boolean {
  return value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r');
}

/** Escape a single value for inclusion in a CSV row. */
export function csvEscape(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'number' ? String(value) : value;
  if (needsQuoting(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Build a full CSV string (header row + data rows) using CRLF line endings. */
export function buildCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvEscape).join(','));
  return lines.join('\r\n');
}

/**
 * Build a CSV and trigger a browser download for it.
 *
 * Prepends a UTF-8 BOM so Excel detects the encoding correctly, rather than
 * mangling non-ASCII characters (client/vendor names, etc).
 */
export function downloadCsv(filename: string, headers: string[], rows: CsvValue[][]): void {
  const csv = buildCsv(headers, rows);
  const blob = new Blob(['\u{FEFF}' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
