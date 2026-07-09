import { getDatabase } from './database.js';

const columnCache = new Map<string, Set<string>>();

/** Real column names for a table, cached. Empty set if table unknown. */
export function getTableColumns(table: string): Set<string> {
  const cached = columnCache.get(table);
  if (cached) return cached;
  try {
    const rows = getDatabase().pragma(`table_info(${table})`) as Array<{ name: string }>;
    const set = new Set(rows.map(r => r.name));
    if (set.size > 0) columnCache.set(table, set);
    return set;
  } catch {
    return new Set();
  }
}

/** True if every column in `cols` is a real column of `table`. */
export function areValidColumns(table: string, cols: string[]): boolean {
  const valid = getTableColumns(table);
  return cols.length > 0 && cols.every(c => valid.has(c));
}

/** Throwing guard for write paths. */
export class InvalidColumnError extends Error {}
export function assertValidColumns(table: string, cols: string[]): void {
  const valid = getTableColumns(table);
  const bad = cols.filter(c => !valid.has(c));
  if (bad.length) throw new InvalidColumnError(`Invalid column(s): ${bad.join(', ')}`);
}
