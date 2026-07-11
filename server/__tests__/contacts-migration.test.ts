process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';

import os from 'os';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { initializeDatabase as InitializeDatabaseFn } from '../db/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbPath: string;
let readDb: InstanceType<typeof Database>;
let initializeDatabase: typeof InitializeDatabaseFn;

/**
 * This file (unlike contacts.test.ts) does NOT use helpers.createTestApp().
 * The backfill migration in server/db/database.ts only does anything the
 * *first* time it sees rows in the legacy `client_contacts` table with an
 * empty `contacts` table - so to exercise it we must write an old-style
 * client_contacts row directly to the SQLite file BEFORE the app's
 * `initializeDatabase()` ever runs against it. createTestApp() picks its own
 * temp path and imports the app immediately, which would run the migration
 * against an empty database before we got a chance to seed anything.
 *
 * Instead we: pick our own temp DB path, apply schema.sql ourselves via a
 * throwaway connection, hand-insert a legacy client + client_contacts row,
 * close that connection, and only then dynamically import ../index.js so
 * its real initializeDatabase() (schema + migrations + seed) runs against
 * the pre-seeded file for real.
 *
 * vitest.config.ts has `isolate: true`, so this file gets its own module
 * registry - the dynamic import of ../index.js here is a genuinely fresh
 * module evaluation, not a cache hit from another test file.
 */
beforeAll(async () => {
  const tempDir = path.join(
    os.tmpdir(),
    `cff-contacts-migration-test-${process.pid}-${crypto.randomBytes(6).toString('hex')}`,
  );
  fs.mkdirSync(tempDir, { recursive: true });

  dbPath = path.join(tempDir, 'test.db');
  process.env.DATABASE_PATH = dbPath;
  process.env.UPLOAD_DIR = path.join(tempDir, 'uploads');

  const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');

  const seedDb = new Database(dbPath);
  seedDb.pragma('foreign_keys = ON');
  seedDb.exec(schema);

  seedDb.prepare(`INSERT INTO clients (id, name) VALUES (?, ?)`).run(
    'legacy-client-1',
    'Legacy Client Pty Ltd',
  );

  // An "active" legacy contact - should end up with a NULL end_date.
  seedDb
    .prepare(
      `INSERT INTO client_contacts
         (id, client_id, name, title, email, phone, notes, is_primary, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      'legacy-contact-sarah',
      'legacy-client-1',
      'Sarah Chen',
      'Office Manager',
      'sarah@legacy.example',
      '555-0100',
      'Prefers email',
      1,
      1,
      '2025-01-15 09:00:00',
      '2025-06-01 10:00:00',
    );

  // An "inactive" legacy contact - should end up with end_date = date part of updated_at.
  seedDb
    .prepare(
      `INSERT INTO client_contacts
         (id, client_id, name, title, email, phone, notes, is_primary, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      'legacy-contact-dana',
      'legacy-client-1',
      'Dana Ortiz',
      'Former Contact',
      null,
      null,
      null,
      0,
      0,
      '2024-03-10 12:00:00',
      '2024-11-20 08:30:00',
    );

  seedDb.close();

  // Trigger the real migration path by importing the app fresh against the
  // pre-seeded DB file.
  await import('../index.js');
  ({ initializeDatabase } = await import('../db/database.js'));

  readDb = new Database(dbPath, { readonly: true });
});

afterAll(() => {
  readDb?.close();
});

describe('contacts backfill migration (client_contacts -> contacts + contact_affiliations)', () => {
  it('converts a legacy active client_contacts row into a contact, reusing the same id', () => {
    const contact = readDb.prepare('SELECT * FROM contacts WHERE id = ?').get('legacy-contact-sarah') as any;
    expect(contact).toBeTruthy();
    expect(contact.name).toBe('Sarah Chen');
    expect(contact.email).toBe('sarah@legacy.example');
    expect(contact.phone).toBe('555-0100');
    expect(contact.notes).toBe('Prefers email');
    expect(contact.is_active).toBe(1);
    expect(contact.created_at).toBe('2025-01-15 09:00:00');
    expect(contact.updated_at).toBe('2025-06-01 10:00:00');
  });

  it('creates a current (end_date NULL) affiliation to the client for the active legacy contact', () => {
    const affiliation = readDb
      .prepare('SELECT * FROM contact_affiliations WHERE contact_id = ?')
      .get('legacy-contact-sarah') as any;
    expect(affiliation).toBeTruthy();
    expect(affiliation.client_id).toBe('legacy-client-1');
    expect(affiliation.vendor_id).toBeNull();
    expect(affiliation.title).toBe('Office Manager');
    expect(affiliation.is_primary).toBe(1);
    expect(affiliation.start_date).toBe('2025-01-15');
    expect(affiliation.end_date).toBeNull();
  });

  it('creates an ended affiliation (end_date = date part of updated_at) for the inactive legacy contact', () => {
    const contact = readDb.prepare('SELECT * FROM contacts WHERE id = ?').get('legacy-contact-dana') as any;
    expect(contact).toBeTruthy();
    expect(contact.is_active).toBe(0);

    const affiliation = readDb
      .prepare('SELECT * FROM contact_affiliations WHERE contact_id = ?')
      .get('legacy-contact-dana') as any;
    expect(affiliation).toBeTruthy();
    expect(affiliation.client_id).toBe('legacy-client-1');
    expect(affiliation.start_date).toBe('2024-03-10');
    expect(affiliation.end_date).toBe('2024-11-20');
  });

  it('leaves the original client_contacts rows untouched as a frozen archive', () => {
    const rows = readDb.prepare('SELECT * FROM client_contacts ORDER BY id').all() as any[];
    expect(rows.length).toBe(2);
    expect(rows.find(r => r.id === 'legacy-contact-sarah')).toBeTruthy();
    expect(rows.find(r => r.id === 'legacy-contact-dana')).toBeTruthy();
  });

  it('is idempotent: re-running initializeDatabase() does not duplicate contacts or affiliations', () => {
    initializeDatabase();

    const contactCount = readDb.prepare('SELECT COUNT(*) as count FROM contacts').get() as { count: number };
    expect(contactCount.count).toBe(2);

    const affiliationCount = readDb
      .prepare('SELECT COUNT(*) as count FROM contact_affiliations')
      .get() as { count: number };
    expect(affiliationCount.count).toBe(2);
  });

  // The "fresh DB, zero client_contacts rows" no-op case is already
  // exercised for real by every other test file: each one calls
  // helpers.createTestApp() against a brand-new temp DB with no
  // client_contacts rows, and initializeDatabase() (including this
  // migration) runs as part of that boot. If the empty-legacy-table guard
  // didn't hold, or logged/threw on an empty table, those suites would fail
  // or emit a spurious log line. A duplicate check here would only be
  // re-running the exact same code path against the exact same shape of
  // database, so it's intentionally not repeated in this file - see
  // contacts.test.ts's beforeAll for the real instance of this case.
});
