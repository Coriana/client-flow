import { v4 as uuidv4 } from 'uuid';
import { execute } from '../db/database.js';

// Tables that should have activity logging
export const loggedTables = new Set([
  'clients',
  'jobs',
  'invoices',
  'payments',
  'expenses',
  'purchases',
  'items',
  'assets',
  'issues',
  'vendors',
  'locations',
  'timesheets',
  'profiles',
  'bank_accounts',
  'kb_articles',
  'kb_attachments',
  'estimates',
  'company_settings',
]);

// Map table to the column that should be used as entity_name
export const entityNameColumn: Record<string, string> = {
  clients: 'name',
  jobs: 'name',
  invoices: 'invoice_number',
  payments: 'reference',
  expenses: 'description',
  purchases: 'description',
  items: 'name',
  assets: 'name',
  issues: 'title',
  vendors: 'name',
  locations: 'name',
  timesheets: 'description',
  profiles: 'full_name',
  bank_accounts: 'name',
  kb_articles: 'title',
  kb_attachments: 'file_name',
  estimates: 'estimate_number',
  company_settings: 'company_name',
};

export type ActivitySource = 'browser' | 'api' | 'system';

export interface LogActivityParams {
  table: string;
  action: 'created' | 'updated' | 'deleted';
  entityId: string | null;
  entityName: string | null;
  userId: string | null;
  oldValues: any | null;
  newValues: any | null;
  source?: ActivitySource;
  apiKeyId?: string | null;
}

/**
 * Log activity for create/update/delete operations
 * Can be called from both browser-based CRUD routes and external API routes
 */
export function logActivity(params: LogActivityParams): void {
  const {
    table,
    action,
    entityId,
    entityName,
    userId,
    oldValues,
    newValues,
    source = 'browser',
    apiKeyId = null,
  } = params;

  if (!loggedTables.has(table)) return;

  const id = uuidv4();
  const description = `${action.toUpperCase()} ${table}`;
  // Use ISO format with Z suffix so JavaScript correctly interprets as UTC
  const createdAt = new Date().toISOString();

  execute(
    `INSERT INTO activity_log (id, entity_type, entity_id, entity_name, action, description, old_values, new_values, user_id, source, api_key_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      table,
      entityId,
      entityName,
      action,
      description,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      userId,
      source,
      apiKeyId,
      createdAt,
    ]
  );
}

/**
 * Extract entity name from record based on table type
 */
export function getEntityName(table: string, record: any): string | null {
  const column = entityNameColumn[table];
  if (!column || !record) return null;
  return record[column] || null;
}
