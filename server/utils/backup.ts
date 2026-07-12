import { promises as fs } from 'fs';
import path from 'path';
import { getDatabase } from '../db/database.js';

const BACKUP_FILE_PREFIX = 'app-';
const BACKUP_FILE_SUFFIX = '.db';

function getBackupDir(): string {
  return process.env.BACKUP_DIR || path.join(process.cwd(), 'data', 'backups');
}

/**
 * Parses a positive-integer-ish env var, falling back to `defaultValue` when
 * unset, non-numeric, or NaN. `allowZero` permits 0 through (used to signal
 * "disabled" for BACKUP_INTERVAL_HOURS).
 */
function parseIntEnv(value: string | undefined, defaultValue: number, allowZero = false): number {
  if (value === undefined || value === '') return defaultValue;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return defaultValue;
  if (parsed < 0) return defaultValue;
  if (parsed === 0 && !allowZero) return defaultValue;
  return parsed;
}

function getBackupIntervalHours(): number {
  return parseIntEnv(process.env.BACKUP_INTERVAL_HOURS, 24, /* allowZero */ true);
}

function getBackupRetention(): number {
  return parseIntEnv(process.env.BACKUP_RETENTION, 7);
}

/** Filesystem-safe timestamp: 20260709-153045 (no colons, no dots). */
function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const mo = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}${mo}${d}-${h}${mi}${s}`;
}

/**
 * Deletes older backups so only the newest `retention` files matching
 * `app-*.db` remain in `dir`. Never throws - callers are expected to be
 * inside a try/catch already, but this is defensive on its own too.
 */
async function pruneOldBackups(dir: string, retention: number): Promise<void> {
  try {
    const entries = await fs.readdir(dir);
    const backupFiles = entries.filter(
      name => name.startsWith(BACKUP_FILE_PREFIX) && name.endsWith(BACKUP_FILE_SUFFIX)
    );

    if (backupFiles.length <= retention) return;

    // Sort newest-first by filename (timestamp format sorts lexicographically
    // in chronological order), then delete everything past the retention count.
    const sorted = backupFiles.sort().reverse();
    const toDelete = sorted.slice(retention);

    await Promise.all(
      toDelete.map(async name => {
        try {
          await fs.unlink(path.join(dir, name));
        } catch (error) {
          console.error(`Backup cleanup: failed to delete old backup ${name}:`, error);
        }
      })
    );
  } catch (error) {
    console.error('Backup cleanup: failed to prune old backups:', error);
  }
}

/**
 * Writes a live copy of the SQLite database to BACKUP_DIR using
 * better-sqlite3's online backup API (safe to run while the app is serving
 * requests / WAL is active). Returns the path written, or null if backups
 * are disabled (BACKUP_INTERVAL_HOURS=0) or the backup failed.
 *
 * Never throws - a backup failure must not crash or otherwise affect the
 * caller (e.g. the server's startup/interval path).
 */
export async function backupDatabase(): Promise<string | null> {
  if (getBackupIntervalHours() === 0) {
    return null;
  }

  try {
    const dir = getBackupDir();
    await fs.mkdir(dir, { recursive: true });

    const filename = `${BACKUP_FILE_PREFIX}${formatTimestamp(new Date())}${BACKUP_FILE_SUFFIX}`;
    const destination = path.join(dir, filename);

    const database = getDatabase();
    await database.backup(destination);

    await pruneOldBackups(dir, getBackupRetention());

    console.log(`Backup: wrote database backup to ${destination}`);
    return destination;
  } catch (error) {
    console.error('Backup: failed to back up database:', error);
    return null;
  }
}

let backupIntervalHandle: NodeJS.Timeout | null = null;

/**
 * Starts the automatic backup schedule: one backup immediately
 * (fire-and-forget, errors are handled internally by backupDatabase), then
 * one every BACKUP_INTERVAL_HOURS. Does nothing if backups are disabled
 * (BACKUP_INTERVAL_HOURS=0).
 *
 * The interval timer is `.unref()`d so it never keeps the Node process
 * alive on its own - graceful shutdown (SIGTERM/SIGINT) is unaffected.
 */
export function startBackupSchedule(): void {
  const intervalHours = getBackupIntervalHours();
  if (intervalHours === 0) {
    return;
  }

  void backupDatabase();

  const intervalMs = intervalHours * 60 * 60 * 1000;
  backupIntervalHandle = setInterval(() => {
    void backupDatabase();
  }, intervalMs).unref();
}

/** Stops the schedule started by startBackupSchedule(). Mainly for tests. */
export function stopBackupSchedule(): void {
  if (backupIntervalHandle) {
    clearInterval(backupIntervalHandle);
    backupIntervalHandle = null;
  }
}
