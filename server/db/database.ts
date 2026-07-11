import Database from 'better-sqlite3';
import { readFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DATABASE_PATH || join(process.cwd(), 'data', 'app.db');

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    // better-sqlite3 won't create the parent directory, and data/ is
    // gitignored — so a fresh checkout has no data/ dir. Create it so the
    // server boots on a clean clone instead of crashing.
    const dbDir = dirname(DB_PATH);
    if (dbDir && !existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initializeDatabase(): void {
  const database = getDatabase();
  
  // Read and execute schema
  const schemaPath = join(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  database.exec(schema);
  
  // Run migrations for existing databases
  runMigrations(database);
  
  // Read and execute seed data
  const seedPath = join(__dirname, 'seed.sql');
  const seed = readFileSync(seedPath, 'utf-8');
  database.exec(seed);
  
  console.log('Database initialized successfully');
}

function runMigrations(database: Database.Database): void {
  // Migration: Add source and api_key_id columns to activity_log
  try {
    const activityColumns = database.pragma('table_info(activity_log)') as Array<{ name: string }>;
    const activityColumnNames = activityColumns.map(c => c.name);
    
    if (!activityColumnNames.includes('source')) {
      database.exec("ALTER TABLE activity_log ADD COLUMN source TEXT DEFAULT 'browser'");
      console.log('Migration: Added source column to activity_log');
    }
    
    if (!activityColumnNames.includes('api_key_id')) {
      database.exec("ALTER TABLE activity_log ADD COLUMN api_key_id TEXT REFERENCES api_keys(id)");
      console.log('Migration: Added api_key_id column to activity_log');
    }
  } catch (error) {
    console.error('Migration error (activity_log):', error);
  }

  // Migration: Add billing_in_advance to job_assets
  try {
    const jobAssetsColumns = database.pragma('table_info(job_assets)') as Array<{ name: string }>;
    const jobAssetsColumnNames = jobAssetsColumns.map(c => c.name);
    
    if (!jobAssetsColumnNames.includes('billing_in_advance')) {
      database.exec("ALTER TABLE job_assets ADD COLUMN billing_in_advance INTEGER DEFAULT 1");
      console.log('Migration: Added billing_in_advance column to job_assets');
    }
  } catch (error) {
    console.error('Migration error (job_assets):', error);
  }

  // Migration: Update existing job_assets to bill in advance (one-time fix)
  try {
    const result = database.prepare("UPDATE job_assets SET billing_in_advance = 1 WHERE billing_in_advance = 0 OR billing_in_advance IS NULL").run();
    if (result.changes > 0) {
      console.log(`Migration: Updated ${result.changes} job_assets to billing_in_advance = 1`);
    }
  } catch (error) {
    console.error('Migration error (job_assets billing_in_advance update):', error);
  }

  // Migration: Add default_billing_in_advance to company_settings
  try {
    const settingsColumns = database.pragma('table_info(company_settings)') as Array<{ name: string }>;
    const settingsColumnNames = settingsColumns.map(c => c.name);
    
    if (!settingsColumnNames.includes('default_billing_in_advance')) {
      database.exec("ALTER TABLE company_settings ADD COLUMN default_billing_in_advance INTEGER DEFAULT 1");
      console.log('Migration: Added default_billing_in_advance column to company_settings');
    }
  } catch (error) {
    console.error('Migration error (company_settings):', error);
  }

  // Migration: Update existing company_settings to bill in advance (one-time fix)
  try {
    const result = database.prepare("UPDATE company_settings SET default_billing_in_advance = 1 WHERE default_billing_in_advance = 0 OR default_billing_in_advance IS NULL").run();
    if (result.changes > 0) {
      console.log(`Migration: Updated company_settings to default_billing_in_advance = 1`);
    }
  } catch (error) {
    console.error('Migration error (company_settings default_billing_in_advance update):', error);
  }

  // Migration: Add abn to trading_names
  try {
    const tradingNamesColumns = database.pragma('table_info(trading_names)') as Array<{ name: string }>;
    const tradingNamesColumnNames = tradingNamesColumns.map(c => c.name);
    
    if (!tradingNamesColumnNames.includes('abn')) {
      database.exec("ALTER TABLE trading_names ADD COLUMN abn TEXT");
      console.log('Migration: Added abn column to trading_names');
    }
  } catch (error) {
    console.error('Migration error (trading_names):', error);
  }

  // Migration: Add default_rental_rate and default_billing_frequency to assets
  try {
    const assetColumns = database.pragma('table_info(assets)') as Array<{ name: string }>;
    const assetColumnNames = assetColumns.map(c => c.name);
    
    if (!assetColumnNames.includes('default_rental_rate')) {
      database.exec("ALTER TABLE assets ADD COLUMN default_rental_rate REAL");
      console.log('Migration: Added default_rental_rate column to assets');
    }
    if (!assetColumnNames.includes('default_billing_frequency')) {
      database.exec("ALTER TABLE assets ADD COLUMN default_billing_frequency TEXT DEFAULT 'monthly'");
      console.log('Migration: Added default_billing_frequency column to assets');
    }
  } catch (error) {
    console.error('Migration error (assets):', error);
  }

  // Migration: Sync assigned_client_id for assets with active rentals
  // This fixes existing job_assets that were created before the auto-assign feature
  try {
    const result = database.prepare(`
      UPDATE assets 
      SET assigned_client_id = (
        SELECT jobs.client_id 
        FROM job_assets 
        JOIN jobs ON jobs.id = job_assets.job_id 
        WHERE job_assets.asset_id = assets.id 
          AND job_assets.is_active = 1 
        ORDER BY job_assets.rental_start_date DESC 
        LIMIT 1
      )
      WHERE id IN (
        SELECT DISTINCT asset_id FROM job_assets WHERE is_active = 1
      )
      AND assigned_client_id IS NULL
    `).run();
    if (result.changes > 0) {
      console.log(`Migration: Synced assigned_client_id for ${result.changes} assets with active rentals`);
    }
  } catch (error) {
    console.error('Migration error (sync assigned_client_id):', error);
  }

  // Migration: Populate default_rental_rate from active job_assets (GST-inclusive)
  // Only runs for assets that don't have a default_rental_rate set yet
  // Adds 10% GST to make the rate inclusive (set INCLUDE_GST to false to skip)
  const INCLUDE_GST = true;
  const GST_MULTIPLIER = INCLUDE_GST ? 1.1 : 1.0;
  try {
    const result = database.prepare(`
      UPDATE assets 
      SET 
        default_rental_rate = (
          SELECT ROUND(job_assets.rental_rate * ${GST_MULTIPLIER}, 2)
          FROM job_assets 
          WHERE job_assets.asset_id = assets.id 
            AND job_assets.is_active = 1 
          ORDER BY job_assets.rental_start_date DESC 
          LIMIT 1
        ),
        default_billing_frequency = (
          SELECT job_assets.billing_frequency
          FROM job_assets 
          WHERE job_assets.asset_id = assets.id 
            AND job_assets.is_active = 1 
          ORDER BY job_assets.rental_start_date DESC 
          LIMIT 1
        )
      WHERE id IN (
        SELECT DISTINCT asset_id FROM job_assets WHERE is_active = 1
      )
      AND default_rental_rate IS NULL
    `).run();
    if (result.changes > 0) {
      console.log(`Migration: Set default_rental_rate (GST-inclusive: ${INCLUDE_GST}) for ${result.changes} assets from active rentals`);
    }
  } catch (error) {
    console.error('Migration error (populate default_rental_rate):', error);
  }

  // Migration: Add invite_token and invite_expires_at to profiles (for invite-based onboarding)
  try {
    const profileColumns = database.pragma('table_info(profiles)') as Array<{ name: string }>;
    const profileColumnNames = profileColumns.map(c => c.name);

    if (!profileColumnNames.includes('invite_token')) {
      database.exec("ALTER TABLE profiles ADD COLUMN invite_token TEXT");
      console.log('Migration: Added invite_token column to profiles');
    }
    if (!profileColumnNames.includes('invite_expires_at')) {
      database.exec("ALTER TABLE profiles ADD COLUMN invite_expires_at TEXT");
      console.log('Migration: Added invite_expires_at column to profiles');
    }
  } catch (error) {
    console.error('Migration error (profiles invite columns):', error);
  }

  // Migration: Add job_prefix and job_next_number to company_settings
  // (mirrors invoice_prefix/invoice_next_number, used by allocateJobNumber())
  try {
    const settingsColumns = database.pragma('table_info(company_settings)') as Array<{ name: string }>;
    const settingsColumnNames = settingsColumns.map(c => c.name);

    if (!settingsColumnNames.includes('job_prefix')) {
      database.exec("ALTER TABLE company_settings ADD COLUMN job_prefix TEXT DEFAULT 'JOB-'");
      console.log('Migration: Added job_prefix column to company_settings');
    }
    if (!settingsColumnNames.includes('job_next_number')) {
      database.exec("ALTER TABLE company_settings ADD COLUMN job_next_number INTEGER DEFAULT 1");
      console.log('Migration: Added job_next_number column to company_settings');
    }
  } catch (error) {
    console.error('Migration error (company_settings job numbering columns):', error);
  }

  // Migration: Add a UNIQUE index on invoices.invoice_number, if it's safe to do so.
  // Older databases may already contain duplicate invoice numbers (a symptom of the
  // COUNT(*)-based generation bug this migration accompanies the fix for). Creating
  // a UNIQUE index over existing duplicates would throw and break server boot, so we
  // check first and skip (with a warning) rather than fail startup. NULLs are fine:
  // SQLite unique indexes allow any number of NULLs.
  try {
    const dupInvoice = database.prepare(
      `SELECT invoice_number FROM invoices WHERE invoice_number IS NOT NULL GROUP BY invoice_number HAVING COUNT(*) > 1 LIMIT 1`
    ).get();
    if (dupInvoice) {
      console.warn('Migration: Skipped UNIQUE index on invoices.invoice_number - existing duplicates found');
    } else {
      database.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number)');
      console.log('Migration: Ensured UNIQUE index idx_invoices_invoice_number');
    }
  } catch (error) {
    console.error('Migration error (idx_invoices_invoice_number):', error);
  }

  // Migration: Add a UNIQUE index on jobs.job_number, same safety approach as above.
  try {
    const dupJob = database.prepare(
      `SELECT job_number FROM jobs WHERE job_number IS NOT NULL GROUP BY job_number HAVING COUNT(*) > 1 LIMIT 1`
    ).get();
    if (dupJob) {
      console.warn('Migration: Skipped UNIQUE index on jobs.job_number - existing duplicates found');
    } else {
      database.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_job_number ON jobs(job_number)');
      console.log('Migration: Ensured UNIQUE index idx_jobs_job_number');
    }
  } catch (error) {
    console.error('Migration error (idx_jobs_job_number):', error);
  }

  // Migration: Backfill person-centric `contacts` / `contact_affiliations`
  // from the legacy `client_contacts` table.
  //
  // client_contacts pinned a person to exactly one client forever. Contacts
  // are now independent people (`contacts`) that can be affiliated with a
  // client OR a vendor over a period of time (`contact_affiliations`), so a
  // person changing companies is a new affiliation row, not a rewritten one.
  //
  // client_contacts is left untouched as a frozen archive - the app stops
  // reading/writing it, but we don't delete historical data. This migration
  // only runs once: it's guarded on `contacts` being empty, so re-running it
  // (e.g. on every boot) after the first successful conversion is a no-op.
  // On a fresh DB, client_contacts has no rows either, so nothing happens
  // and nothing is logged.
  try {
    const { count: contactsCount } = database
      .prepare('SELECT COUNT(*) as count FROM contacts')
      .get() as { count: number };

    if (contactsCount === 0) {
      const legacyContacts = database
        .prepare('SELECT * FROM client_contacts')
        .all() as Array<{
          id: string;
          client_id: string;
          name: string;
          title: string | null;
          email: string | null;
          phone: string | null;
          notes: string | null;
          is_primary: number | null;
          is_active: number | null;
          created_at: string;
          updated_at: string;
        }>;

      if (legacyContacts.length > 0) {
        const insertContact = database.prepare(`
          INSERT INTO contacts (id, name, email, phone, notes, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertAffiliation = database.prepare(`
          INSERT INTO contact_affiliations
            (id, contact_id, client_id, title, is_primary, start_date, end_date, notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const datePart = (timestamp: string) => timestamp.split(' ')[0].split('T')[0];

        const migrateLegacyContacts = database.transaction((rows: typeof legacyContacts) => {
          for (const row of rows) {
            insertContact.run(
              row.id,
              row.name,
              row.email,
              row.phone,
              row.notes,
              row.is_active,
              row.created_at,
              row.updated_at,
            );

            insertAffiliation.run(
              crypto.randomUUID(),
              row.id,
              row.client_id,
              row.title,
              row.is_primary,
              datePart(row.created_at),
              row.is_active ? null : datePart(row.updated_at),
              row.notes,
              row.created_at,
              row.updated_at,
            );
          }
        });

        migrateLegacyContacts(legacyContacts);
        console.log(`Migration: Converted ${legacyContacts.length} client_contacts row(s) into contacts + contact_affiliations`);
      }
    }
  } catch (error) {
    console.error('Migration error (contacts backfill from client_contacts):', error);
  }

  // Migration: Backfill `contacts` / `contact_affiliations` from the legacy
  // `vendor_contacts` table, mirroring the client_contacts backfill above.
  //
  // vendor_contacts is left untouched as a frozen archive, same as
  // client_contacts. The contacts-empty guard used above can't be reused
  // here: by the time this runs, `contacts` already holds the migrated
  // client people, so it is never empty on the boot that should migrate
  // vendors. Instead, idempotency is keyed on the ids themselves - contact
  // ids are reused from vendor_contacts, so if ANY vendor_contacts id
  // already exists in contacts this migration has already run and is
  // skipped. On a fresh DB, vendor_contacts has no rows and nothing happens.
  try {
    const { count: vendorContactsCount } = database
      .prepare('SELECT COUNT(*) as count FROM vendor_contacts')
      .get() as { count: number };

    if (vendorContactsCount > 0) {
      const { count: alreadyMigratedCount } = database
        .prepare(
          `SELECT COUNT(*) as count FROM vendor_contacts vc
           WHERE EXISTS (SELECT 1 FROM contacts c WHERE c.id = vc.id)`,
        )
        .get() as { count: number };

      if (alreadyMigratedCount === 0) {
        const legacyVendorContacts = database
          .prepare('SELECT * FROM vendor_contacts')
          .all() as Array<{
            id: string;
            vendor_id: string;
            name: string;
            title: string | null;
            email: string | null;
            phone: string | null;
            notes: string | null;
            is_primary: number | null;
            is_active: number | null;
            created_at: string;
            updated_at: string;
          }>;

        const insertContact = database.prepare(`
          INSERT INTO contacts (id, name, email, phone, notes, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertAffiliation = database.prepare(`
          INSERT INTO contact_affiliations
            (id, contact_id, vendor_id, title, is_primary, start_date, end_date, notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const datePart = (timestamp: string) => timestamp.split(' ')[0].split('T')[0];

        const migrateLegacyVendorContacts = database.transaction((rows: typeof legacyVendorContacts) => {
          for (const row of rows) {
            insertContact.run(
              row.id,
              row.name,
              row.email,
              row.phone,
              row.notes,
              row.is_active,
              row.created_at,
              row.updated_at,
            );

            insertAffiliation.run(
              crypto.randomUUID(),
              row.id,
              row.vendor_id,
              row.title,
              row.is_primary,
              datePart(row.created_at),
              row.is_active ? null : datePart(row.updated_at),
              row.notes,
              row.created_at,
              row.updated_at,
            );
          }
        });

        migrateLegacyVendorContacts(legacyVendorContacts);
        console.log(`Migration: Converted ${legacyVendorContacts.length} vendor_contacts row(s) into contacts + contact_affiliations`);
      }
    }
  } catch (error) {
    console.error('Migration error (contacts backfill from vendor_contacts):', error);
  }

  // Migration: Preserve orphaned free-text contact info by converting it into
  // the person-centric model. A client/vendor whose inline contact_name was
  // typed by hand (with no corresponding current primary affiliation) would
  // otherwise have those columns NULLed by the recompute below, since the new
  // model treats them as a mirror of the current primary contact. Convert each
  // such org's inline info into a contacts row (reusing an existing contact
  // when the normalized name+email already match) plus a current primary
  // affiliation, so the recompute converges on the same values and nothing is
  // lost. Idempotent: once the affiliation exists, the org no longer
  // qualifies as orphaned.
  try {
    const datePart = (timestamp: string | null) =>
      ((timestamp ?? '').split(' ')[0].split('T')[0]) || null;

    for (const entity of ['clients', 'vendors'] as const) {
      const fkColumn = entity === 'clients' ? 'client_id' : 'vendor_id';
      const orphans = database.prepare(`
        SELECT id, contact_name, contact_email, contact_phone, created_at FROM ${entity} o
        WHERE contact_name IS NOT NULL AND TRIM(contact_name) <> ''
          AND NOT EXISTS (
            SELECT 1 FROM contact_affiliations ca
            WHERE ca.${fkColumn} = o.id AND ca.is_primary = 1 AND ca.end_date IS NULL
          )
      `).all() as Array<{
        id: string;
        contact_name: string;
        contact_email: string | null;
        contact_phone: string | null;
        created_at: string | null;
      }>;

      if (orphans.length === 0) continue;

      const findContact = database.prepare(`
        SELECT id FROM contacts
        WHERE lower(trim(name)) = lower(trim(?))
          AND COALESCE(lower(trim(email)), '') = COALESCE(lower(trim(?)), '')
        LIMIT 1
      `);
      const insertContact = database.prepare(
        'INSERT INTO contacts (id, name, email, phone) VALUES (?, ?, ?, ?)',
      );
      const insertAffiliation = database.prepare(`
        INSERT INTO contact_affiliations (id, contact_id, ${fkColumn}, is_primary, start_date)
        VALUES (?, ?, ?, 1, ?)
      `);

      const convertOrphans = database.transaction((rows: typeof orphans) => {
        for (const row of rows) {
          const existing = findContact.get(row.contact_name, row.contact_email) as
            | { id: string }
            | undefined;
          let contactId = existing?.id;
          if (!contactId) {
            contactId = crypto.randomUUID();
            insertContact.run(contactId, row.contact_name.trim(), row.contact_email, row.contact_phone);
          }
          insertAffiliation.run(crypto.randomUUID(), contactId, row.id, datePart(row.created_at));
        }
      });

      convertOrphans(orphans);
      console.log(
        `Migration: Converted inline contact info on ${orphans.length} ${entity} row(s) into contacts + primary affiliations`,
      );
    }
  } catch (error) {
    console.error('Migration error (orphaned inline contact_* conversion):', error);
  }

  // Migration: Backfill clients.contact_name/contact_email/contact_phone and
  // vendors.contact_name/contact_email/contact_phone from each org's current
  // primary contact affiliation (contact_affiliations.is_primary = 1 AND
  // end_date IS NULL, contact_id -> contacts). Going forward these columns
  // are kept fresh automatically by the trg_contact_affiliations_sync_* /
  // trg_contacts_sync_au triggers in schema.sql, but those only fire on new
  // mutations - rows that predate the triggers (including anything carried
  // over from the client_contacts/vendor_contacts backfills above, or old
  // free-text values entered before the person-centric contacts model)
  // need a one-time recompute so they match the new source of truth.
  //
  // Safe to run on every boot: the WHERE clause (comparing each column to
  // its freshly-computed value with the NULL-safe `IS NOT`) only touches
  // rows that actually need a change, so after the first real run this is a
  // 0-row, silent no-op - matching the "only log when it actually runs"
  // convention used throughout this file.
  try {
    const clientsResult = database.prepare(`
      UPDATE clients SET
        contact_name = (SELECT c.name FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.client_id = clients.id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1),
        contact_email = (SELECT c.email FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.client_id = clients.id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1),
        contact_phone = (SELECT c.phone FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.client_id = clients.id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1)
      WHERE
        contact_name IS NOT (SELECT c.name FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.client_id = clients.id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1)
        OR contact_email IS NOT (SELECT c.email FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.client_id = clients.id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1)
        OR contact_phone IS NOT (SELECT c.phone FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.client_id = clients.id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1)
    `).run();
    if (clientsResult.changes > 0) {
      console.log(`Migration: Recomputed contact_name/contact_email/contact_phone for ${clientsResult.changes} client(s) from their primary contact affiliation`);
    }
  } catch (error) {
    console.error('Migration error (clients contact_* backfill from contact_affiliations):', error);
  }

  try {
    const vendorsResult = database.prepare(`
      UPDATE vendors SET
        contact_name = (SELECT c.name FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.vendor_id = vendors.id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1),
        contact_email = (SELECT c.email FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.vendor_id = vendors.id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1),
        contact_phone = (SELECT c.phone FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.vendor_id = vendors.id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1)
      WHERE
        contact_name IS NOT (SELECT c.name FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.vendor_id = vendors.id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1)
        OR contact_email IS NOT (SELECT c.email FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.vendor_id = vendors.id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1)
        OR contact_phone IS NOT (SELECT c.phone FROM contact_affiliations ca JOIN contacts c ON c.id = ca.contact_id WHERE ca.vendor_id = vendors.id AND ca.is_primary = 1 AND ca.end_date IS NULL LIMIT 1)
    `).run();
    if (vendorsResult.changes > 0) {
      console.log(`Migration: Recomputed contact_name/contact_email/contact_phone for ${vendorsResult.changes} vendor(s) from their primary contact affiliation`);
    }
  } catch (error) {
    console.error('Migration error (vendors contact_* backfill from contact_affiliations):', error);
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Query helpers that mimic Supabase-style responses
export interface QueryResult<T> {
  data: T | null;
  error: Error | null;
  count?: number;
}

export function queryAll<T>(sql: string, params: any[] = []): QueryResult<T[]> {
  try {
    const database = getDatabase();
    const stmt = database.prepare(sql);
    const data = stmt.all(...params) as T[];
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

export function queryOne<T>(sql: string, params: any[] = []): QueryResult<T> {
  try {
    const database = getDatabase();
    const stmt = database.prepare(sql);
    const data = stmt.get(...params) as T | undefined;
    return { data: data || null, error: null };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

export function execute(sql: string, params: any[] = []): QueryResult<{ changes: number; lastInsertRowid: number }> {
  try {
    const database = getDatabase();
    const stmt = database.prepare(sql);
    const result = stmt.run(...params);
    return { 
      data: { 
        changes: result.changes, 
        lastInsertRowid: Number(result.lastInsertRowid) 
      }, 
      error: null 
    };
  } catch (error) {
    return { data: null, error: error as Error };
  }
}

// Transaction helper
export function transaction<T>(fn: () => T): T {
  const database = getDatabase();
  return database.transaction(fn)();
}
