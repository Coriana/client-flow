import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DATABASE_PATH || join(process.cwd(), 'data', 'app.db');

let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
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
