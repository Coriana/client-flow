process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';

import os from 'os';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { describe, it, expect, beforeAll } from 'vitest';
import { createTestApp } from './helpers.js';
import type { backupDatabase as BackupDatabaseFn } from '../utils/backup.js';

let backupDatabase: typeof BackupDatabaseFn;
let backupDir: string;

beforeAll(async () => {
  // createTestApp() sets DATABASE_PATH/UPLOAD_DIR and dynamically imports the
  // app so initializeDatabase() runs (and seeds) against a fresh temp DB.
  // server/db/database.ts freezes its DB_PATH constant at module-evaluation
  // time, so ../utils/backup.js (which imports getDatabase from it) must ALSO
  // be imported dynamically, after createTestApp() and after BACKUP_DIR is set
  // - a static top-level import here would bind to the wrong database/dir.
  await createTestApp();

  backupDir = path.join(
    os.tmpdir(),
    `cff-backup-test-${process.pid}-${crypto.randomBytes(6).toString('hex')}`,
  );
  process.env.BACKUP_DIR = backupDir;

  ({ backupDatabase } = await import('../utils/backup.js'));
});

describe('backupDatabase()', () => {
  it('writes a valid, queryable SQLite copy containing seeded data', async () => {
    const backupPath = await backupDatabase();

    expect(backupPath).toBeTruthy();
    expect(fs.existsSync(backupPath as string)).toBe(true);
    expect(path.dirname(backupPath as string)).toBe(backupDir);
    expect(path.basename(backupPath as string)).toMatch(/^app-\d{8}-\d{6}\.db$/);

    // Open the backup independently and confirm it's a real, readable SQLite
    // database with the seeded data copied over.
    const copy = new Database(backupPath as string, { readonly: true });
    try {
      const profileCount = copy.prepare('SELECT COUNT(*) AS count FROM profiles').get() as { count: number };
      expect(typeof profileCount.count).toBe('number');
      expect(profileCount.count).toBeGreaterThan(0);

      const settings = copy.prepare('SELECT name FROM company_settings LIMIT 1').get() as
        | { name: string }
        | undefined;
      expect(settings).toBeTruthy();
    } finally {
      copy.close();
    }
  });

  it('prunes old backups so only BACKUP_RETENTION newest app-*.db files remain', async () => {
    // Seed a handful of fake, older backup files with distinct, sortable
    // timestamps so pruning behavior doesn't depend on real-time timestamp
    // granularity (the real filenames are only second-precision).
    const fakeTimestamps = [
      'app-20200101-000000.db',
      'app-20200102-000000.db',
      'app-20200103-000000.db',
      'app-20200104-000000.db',
    ];
    for (const name of fakeTimestamps) {
      fs.writeFileSync(path.join(backupDir, name), 'not a real sqlite file, just for pruning test');
    }

    process.env.BACKUP_RETENTION = '2';
    try {
      const backupPath = await backupDatabase();
      expect(backupPath).toBeTruthy();

      const remaining = fs
        .readdirSync(backupDir)
        .filter(name => name.startsWith('app-') && name.endsWith('.db'))
        .sort();

      expect(remaining).toHaveLength(2);
      // The newest real backup (created just now) must survive, along with
      // the next-newest fake one; the older fakes must have been deleted.
      expect(remaining).toContain(path.basename(backupPath as string));
      expect(remaining).toContain('app-20200104-000000.db');
      expect(remaining).not.toContain('app-20200101-000000.db');
      expect(remaining).not.toContain('app-20200102-000000.db');
      expect(remaining).not.toContain('app-20200103-000000.db');
    } finally {
      delete process.env.BACKUP_RETENTION;
    }
  });

  it('returns null and skips writing when BACKUP_INTERVAL_HOURS=0 (disabled)', async () => {
    process.env.BACKUP_INTERVAL_HOURS = '0';
    try {
      const before = fs.readdirSync(backupDir).length;
      const result = await backupDatabase();
      expect(result).toBeNull();
      const after = fs.readdirSync(backupDir).length;
      expect(after).toBe(before);
    } finally {
      delete process.env.BACKUP_INTERVAL_HOURS;
    }
  });
});
