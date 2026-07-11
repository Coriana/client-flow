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
 * Exercises the "orphaned inline contact info" migration: clients/vendors
 * whose free-text contact_name/contact_email/contact_phone columns hold data
 * with no corresponding current primary affiliation. Without conversion, the
 * contact_* recompute (which mirrors the current primary affiliated contact)
 * would NULL that data on first boot. The migration must instead convert it
 * into a contacts row + current primary affiliation, reusing an existing
 * contact when the normalized name+email already match.
 *
 * Same setup technique as contacts-migration.test.ts (own temp DB, seed via a
 * throwaway connection BEFORE importing ../index.js; vitest isolate:true
 * gives this file a fresh module registry). Kept as a separate file so its
 * seeds don't disturb that file's exact-count assertions.
 */
beforeAll(async () => {
  const tempDir = path.join(
    os.tmpdir(),
    `cff-orphan-contact-test-${process.pid}-${crypto.randomBytes(6).toString('hex')}`,
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

  // A vendor with hand-typed inline contact info and no affiliations.
  seedDb
    .prepare(
      `INSERT INTO vendors (id, name, contact_name, contact_email, contact_phone, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run('orphan-vendor-1', 'Orphan Vendor Co', 'Wes Field', 'wes@orphan.example', '555-0199', '2025-03-01 08:00:00');

  // A client with hand-typed inline contact info and no affiliations.
  seedDb
    .prepare(
      `INSERT INTO clients (id, name, contact_name, contact_email, contact_phone, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run('orphan-client-1', 'Orphan Client Pty Ltd', 'Ines Rojas', 'ines@orphanclient.example', null, '2025-04-10 09:15:00');

  // A pre-existing person whose normalized name+email match a client's inline
  // info: the migration must REUSE this contact, not create a duplicate.
  seedDb
    .prepare('INSERT INTO contacts (id, name, email) VALUES (?, ?, ?)')
    .run('existing-shared-person', 'Shared Person', 'shared@example.com');
  seedDb
    .prepare(
      `INSERT INTO clients (id, name, contact_name, contact_email, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run('orphan-client-2', 'Reuse Client Pty Ltd', '  shared person ', 'SHARED@example.com', '2025-05-01 10:00:00');

  seedDb.close();

  await import('../index.js');
  ({ initializeDatabase } = await import('../db/database.js'));

  readDb = new Database(dbPath, { readonly: true });
});

afterAll(() => {
  readDb?.close();
});

describe('orphaned inline contact info migration', () => {
  it('converts a vendor\'s inline contact info into a contact + current primary affiliation', () => {
    const contact = readDb
      .prepare('SELECT * FROM contacts WHERE name = ?')
      .get('Wes Field') as any;
    expect(contact).toBeTruthy();
    expect(contact.email).toBe('wes@orphan.example');
    expect(contact.phone).toBe('555-0199');

    const affiliation = readDb
      .prepare('SELECT * FROM contact_affiliations WHERE contact_id = ?')
      .get(contact.id) as any;
    expect(affiliation).toBeTruthy();
    expect(affiliation.vendor_id).toBe('orphan-vendor-1');
    expect(affiliation.client_id).toBeNull();
    expect(affiliation.is_primary).toBe(1);
    expect(affiliation.end_date).toBeNull();
    expect(affiliation.start_date).toBe('2025-03-01');
  });

  it('converts a client\'s inline contact info the same way', () => {
    const contact = readDb
      .prepare('SELECT * FROM contacts WHERE name = ?')
      .get('Ines Rojas') as any;
    expect(contact).toBeTruthy();

    const affiliation = readDb
      .prepare('SELECT * FROM contact_affiliations WHERE contact_id = ?')
      .get(contact.id) as any;
    expect(affiliation).toBeTruthy();
    expect(affiliation.client_id).toBe('orphan-client-1');
    expect(affiliation.is_primary).toBe(1);
    expect(affiliation.end_date).toBeNull();
  });

  it('preserves the inline contact_* columns instead of wiping them (recompute converges)', () => {
    const vendor = readDb.prepare('SELECT * FROM vendors WHERE id = ?').get('orphan-vendor-1') as any;
    expect(vendor.contact_name).toBe('Wes Field');
    expect(vendor.contact_email).toBe('wes@orphan.example');
    expect(vendor.contact_phone).toBe('555-0199');

    const client = readDb.prepare('SELECT * FROM clients WHERE id = ?').get('orphan-client-1') as any;
    expect(client.contact_name).toBe('Ines Rojas');
    expect(client.contact_email).toBe('ines@orphanclient.example');
  });

  it('reuses an existing contact when normalized name+email match, instead of duplicating', () => {
    const matches = readDb
      .prepare('SELECT * FROM contacts WHERE lower(trim(name)) = ?')
      .all('shared person') as any[];
    expect(matches.length).toBe(1);
    expect(matches[0].id).toBe('existing-shared-person');

    const affiliation = readDb
      .prepare('SELECT * FROM contact_affiliations WHERE client_id = ?')
      .get('orphan-client-2') as any;
    expect(affiliation).toBeTruthy();
    expect(affiliation.contact_id).toBe('existing-shared-person');
    expect(affiliation.is_primary).toBe(1);
  });

  it('is idempotent: re-running initializeDatabase() creates no duplicates', () => {
    const before = readDb.prepare('SELECT COUNT(*) as count FROM contacts').get() as { count: number };
    const beforeAff = readDb
      .prepare('SELECT COUNT(*) as count FROM contact_affiliations')
      .get() as { count: number };

    initializeDatabase();

    const after = readDb.prepare('SELECT COUNT(*) as count FROM contacts').get() as { count: number };
    const afterAff = readDb
      .prepare('SELECT COUNT(*) as count FROM contact_affiliations')
      .get() as { count: number };

    expect(after.count).toBe(before.count);
    expect(afterAff.count).toBe(beforeAff.count);
  });
});
