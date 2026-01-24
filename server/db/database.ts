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
  
  // Read and execute seed data
  const seedPath = join(__dirname, 'seed.sql');
  const seed = readFileSync(seedPath, 'utf-8');
  database.exec(seed);
  
  console.log('Database initialized successfully');
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
