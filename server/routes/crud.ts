import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from '../db/database.js';
import { authMiddleware, optionalAuthMiddleware, AuthRequest, requirePermission } from '../middleware/auth.js';
import { logActivity, getEntityName } from '../utils/activityLogger.js';
import type { ParsedQs } from 'qs';

const router = Router();

const tableResourceMap: Record<string, string> = {
  clients: 'clients',
  client_contacts: 'clients',
  jobs: 'jobs',
  job_assignments: 'jobs',
  job_assets: 'jobs',
  timesheets: 'jobs',
  invoices: 'invoices',
  invoice_lines: 'invoices',
  payments: 'payments',
  expenses: 'expenses',
  purchases: 'purchases',
  purchase_allocations: 'purchases',
  items: 'inventory',
  inventory_movements: 'inventory',
  assets: 'assets',
  asset_documents: 'assets',
  asset_history: 'assets',
  asset_maintenance: 'assets',
  asset_versions: 'assets',
  issues: 'issues',
  issue_comments: 'issues',
  issue_assets: 'issues',
  issue_items: 'issues',
  issue_jobs: 'issues',
  issue_bookmarks: 'issues',
  kb_articles: 'kb',
  kb_attachments: 'kb',
  kb_article_issues: 'kb',
  vendors: 'vendors',
  vendor_contacts: 'vendors',
  locations: 'locations',
  location_contacts: 'locations',
  bank_accounts: 'banking',
  bank_transactions: 'banking',
  profiles: 'team',
  user_roles: 'team',
  roles: 'settings',
  role_permissions: 'settings',
  company_settings: 'settings',
  trading_names: 'settings',
  tax_rates: 'settings',
  accounts: 'banking',
  activity_log: 'settings',
  api_keys: 'settings',
  api_request_log: 'settings',
};

const allowedTables = new Set(Object.keys(tableResourceMap));
const publicTables = new Set(['company_settings']);

type RelationConfig = {
  table: string;
  fk?: string;
  direction?: 'belongsTo' | 'hasMany';
  localKey?: string;
  remoteKey?: string;
};

type SelectRelation = {
  relationName: string;
  alias?: string;
};

type QueryParamValue = string | ParsedQs | (string | ParsedQs)[] | undefined;

const relationMappings: Record<string, Record<string, RelationConfig>> = {
  clients: {
    locations: { table: 'locations', fk: 'location_id' },
  },
  jobs: {
    clients: { table: 'clients', fk: 'client_id' },
    locations: { table: 'locations', fk: 'location_id' },
    trading_names: { table: 'trading_names', fk: 'trading_name_id' },
    invoices: { table: 'invoices', direction: 'hasMany', localKey: 'id', remoteKey: 'job_id' },
  },
  invoices: {
    clients: { table: 'clients', fk: 'client_id' },
    jobs: { table: 'jobs', fk: 'job_id' },
  },
  purchases: {
    vendors: { table: 'vendors', fk: 'vendor_id' },
  },
  timesheets: {
    jobs: { table: 'jobs', fk: 'job_id' },
    profiles: { table: 'profiles', fk: 'user_id' },
    user_id: { table: 'profiles', fk: 'user_id' },  // alias for profiles:user_id syntax
  },
  expenses: {
    jobs: { table: 'jobs', fk: 'job_id' },
  },
  assets: {
    assigned_client: { table: 'clients', fk: 'assigned_client_id' },
    assigned_client_id: { table: 'clients', fk: 'assigned_client_id' },  // alias for assigned_client:assigned_client_id syntax
  },
  job_assets: {
    jobs: { table: 'jobs', fk: 'job_id' },
    assets: { table: 'assets', fk: 'asset_id' },
  },
  user_roles: {
    role_id: { table: 'roles', fk: 'role_id' },
  },
  role_permissions: {
    resource_id: { table: 'resources', fk: 'resource_id' },
  },
};

function splitSelect(select: string): string[] {
  const tokens: string[] = [];
  let buffer = '';
  let depth = 0;

  for (const char of select) {
    if (char === ',' && depth === 0) {
      if (buffer.trim()) {
        tokens.push(buffer.trim());
      }
      buffer = '';
      continue;
    }

    if (char === '(') depth++;
    if (char === ')') depth = Math.max(0, depth - 1);
    buffer += char;
  }

  if (buffer.trim()) {
    tokens.push(buffer.trim());
  }

  return tokens;
}

function parseSelect(select: string): { fields: string[]; relations: SelectRelation[] } {
  if (!select) {
    return { fields: ['*'], relations: [] };
  }

  const tokens = splitSelect(select.replace(/\s+/g, ' '));
  const fields: string[] = [];
  const relations: SelectRelation[] = [];

  for (const token of tokens) {
    if (token === '*') {
      fields.push('*');
      continue;
    }

    const parenIndex = token.indexOf('(');
    if (parenIndex !== -1 && token.endsWith(')')) {
      const before = token.slice(0, parenIndex).trim();
      if (!before) continue;
      const inner = token.slice(parenIndex + 1, -1);
      const [aliasPart, relationPart] = before.includes(':')
        ? before.split(':', 2).map(part => part.trim())
        : [undefined, before];

      relations.push({
        relationName: relationPart,
        alias: aliasPart,
      });
      continue;
    }

    fields.push(token);
  }

  if (fields.length === 0) {
    fields.push('*');
  }

  return { fields, relations };
}

function normalizeQueryValue(value: any): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === 'string' ? first : undefined;
  }
  return typeof value === 'string' ? value : undefined;
}

function normalizePayload(table: string, payload: Record<string, any>) {
  const normalized: Record<string, any> = { ...payload };

  Object.entries(normalized).forEach(([key, value]) => {
    if (typeof value === 'boolean') {
      normalized[key] = value ? 1 : 0;
      return;
    }
    if (Array.isArray(value)) {
      normalized[key] = JSON.stringify(value);
    }
  });

  if (table === 'trading_names') {
    if (normalized.bsb !== undefined && normalized.bank_bsb === undefined) {
      normalized.bank_bsb = normalized.bsb;
      delete normalized.bsb;
    }
    if (normalized.account_number !== undefined && normalized.bank_account_number === undefined) {
      normalized.bank_account_number = normalized.account_number;
      delete normalized.account_number;
    }
  }

  return normalized;
}

function buildWhereClause(query: Record<string, any>, tableName: string): { clause: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];

  const splitFilters = (input: string): string[] => {
    const tokens: string[] = [];
    let buffer = '';
    let depth = 0;

    for (const char of input) {
      if (char === ',' && depth === 0) {
        if (buffer.trim()) tokens.push(buffer.trim());
        buffer = '';
        continue;
      }
      if (char === '(') depth++;
      if (char === ')') depth = Math.max(0, depth - 1);
      buffer += char;
    }

    if (buffer.trim()) tokens.push(buffer.trim());
    return tokens;
  };

  const parseValues = (raw: string): any[] => {
    const trimmed = raw.trim();
    const unwrapped = trimmed.startsWith('(') && trimmed.endsWith(')')
      ? trimmed.slice(1, -1)
      : trimmed;
    return unwrapped
      .split(',')
      .map(value => value.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, ''))
      .filter(Boolean);
  };

  const normalizeBooleanValue = (value: string): string | number => {
    if (value === 'true') return 1;
    if (value === 'false') return 0;
    return value;
  };

  const buildCondition = (field: string, operator: string, value: string, negated: boolean) => {
    const column = `${tableName}.${field}`;

    switch (operator) {
      case 'eq':
        return { sql: `${column} ${negated ? '!=' : '='} ?`, params: [normalizeBooleanValue(value)] };
      case 'neq':
        return { sql: `${column} ${negated ? '=' : '!='} ?`, params: [normalizeBooleanValue(value)] };
      case 'gt':
        return { sql: `${column} ${negated ? '<=' : '>'} ?`, params: [normalizeBooleanValue(value)] };
      case 'gte':
        return { sql: `${column} ${negated ? '<' : '>='} ?`, params: [normalizeBooleanValue(value)] };
      case 'lt':
        return { sql: `${column} ${negated ? '>=' : '<'} ?`, params: [normalizeBooleanValue(value)] };
      case 'lte':
        return { sql: `${column} ${negated ? '>' : '<='} ?`, params: [normalizeBooleanValue(value)] };
      case 'like':
        return { sql: `${column} ${negated ? 'NOT LIKE' : 'LIKE'} ?`, params: [value] };
      case 'ilike':
        return { sql: `${column} ${negated ? 'NOT LIKE' : 'LIKE'} ? COLLATE NOCASE`, params: [value] };
      case 'is': {
        if (value === 'null') {
          return { sql: `${column} IS ${negated ? 'NOT ' : ''}NULL`, params: [] };
        }
        if (value === 'not.null') {
          return { sql: `${column} IS ${negated ? '' : 'NOT '}NULL`, params: [] };
        }
        return { sql: `${column} IS ${negated ? 'NOT ' : ''}?`, params: [value] };
      }
      case 'in': {
        const values = parseValues(value).map(entry =>
          typeof entry === 'string' ? normalizeBooleanValue(entry) : entry
        );
        const placeholders = values.map(() => '?').join(',');
        return {
          sql: `${column} ${negated ? 'NOT ' : ''}IN (${placeholders})`,
          params: values,
        };
      }
      default:
        return { sql: `${column} ${negated ? '!=' : '='} ?`, params: [normalizeBooleanValue(value)] };
    }
  };

  const parseFilter = (raw: string) => {
    const parts = raw.split('.');
    const field = parts[0];
    let operator = parts[1];
    let negated = false;

    if (operator === 'not') {
      negated = true;
      operator = parts[2];
      parts.splice(0, 3);
    } else {
      parts.splice(0, 2);
    }

    const value = parts.join('.');
    return buildCondition(field, operator, value, negated);
  };

  for (const [key, value] of Object.entries(query)) {
    if (['select', 'order', 'limit', 'offset', 'count', 'or'].includes(key)) continue;

    if (key.includes('.not.')) {
      const [field, operator] = key.split('.not.');
      const clause = buildCondition(field, operator, String(value), true);
      conditions.push(clause.sql);
      params.push(...clause.params);
      continue;
    }

    if (key.includes('.')) {
      const clause = parseFilter(`${key}.${String(value)}`.replace('..', '.'));
      conditions.push(clause.sql);
      params.push(...clause.params);
      continue;
    }

    conditions.push(`${tableName}.${key} = ?`);
    params.push(value);
  }

  const orValue = normalizeQueryValue(query.or as QueryParamValue);
  if (orValue) {
    const orParts = splitFilters(orValue);
    const orConditions: string[] = [];
    const orParams: any[] = [];

    orParts.forEach(part => {
      if (!part) return;
      const clause = parseFilter(part);
      orConditions.push(clause.sql);
      orParams.push(...clause.params);
    });

    if (orConditions.length > 0) {
      conditions.push(`(${orConditions.join(' OR ')})`);
      params.push(...orParams);
    }
  }

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

async function attachRelations(table: string, rows: any[], relations: SelectRelation[]): Promise<void> {
  if (!rows.length || !relations.length) return;
  const tableRelations = relationMappings[table] || {};

  for (const rel of relations) {
    const config = tableRelations[rel.relationName];
    if (!config) continue;
    const alias = rel.alias || rel.relationName;

    if (config.direction === 'hasMany') {
      const parentKey = config.localKey || 'id';
      const remoteKey = config.remoteKey || `${table.slice(0, -1)}_id`;
      const parentIds = Array.from(new Set(rows.map(row => row[parentKey]).filter(Boolean)));
      if (!parentIds.length) {
        rows.forEach(row => (row[alias] = []));
        continue;
      }

      const placeholders = parentIds.map(() => '?').join(',');
      const result = queryAll<any>(
        `SELECT * FROM ${config.table} WHERE ${remoteKey} IN (${placeholders})`,
        parentIds,
      );

      if (result.error) continue;

      const grouped = new Map<string | number, any[]>();
      (result.data || []).forEach(item => {
        const key = item[remoteKey];
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(item);
      });

      rows.forEach(row => {
        const key = row[parentKey];
        row[alias] = grouped.get(key) || [];
      });
    } else {
      const fk = config.fk;
      if (!fk) continue;
      const ids = Array.from(new Set(rows.map(row => row[fk]).filter(Boolean)));
      if (!ids.length) {
        rows.forEach(row => (row[alias] = null));
        continue;
      }

      const placeholders = ids.map(() => '?').join(',');
      const result = queryAll<any>(`SELECT * FROM ${config.table} WHERE id IN (${placeholders})`, ids);
      if (result.error) continue;

      const map = new Map<string | number, any>();
      (result.data || []).forEach(item => map.set(item.id, item));
      rows.forEach(row => {
        row[alias] = map.get(row[fk]) || null;
      });
    }
  }
}

function withAuth(
  req: AuthRequest,
  res: Response,
  table: string,
  handler: () => Promise<void>,
  options?: { write?: boolean },
) {
  const isPublic = publicTables.has(table);
  const runner = isPublic ? optionalAuthMiddleware : authMiddleware;
  runner(req, res, async () => {
    if (!isPublic) {
      const resource = tableResourceMap[table];
      const permission = requirePermission(resource, options?.write ? 'write' : 'read');
      await permission(req, res, handler);
      return;
    }
    await handler();
  });
}

router.get('/:table', (req: AuthRequest, res: Response) => {
  const tableParam = Array.isArray(req.params.table) ? req.params.table[0] : req.params.table;
  if (!tableParam || !allowedTables.has(tableParam)) {
    res.status(400).json({ error: `Invalid table: ${tableParam || 'unknown'}` });
    return;
  }

  withAuth(req, res, tableParam, async () => {
    const { select, order, limit, offset, count } = req.query as Record<string, QueryParamValue>;
    const selectValue = normalizeQueryValue(select) || '*';
    const { fields, relations } = parseSelect(selectValue);
    const tableRelations = relationMappings[tableParam] || {};

    if (!fields.includes('*') && relations.length > 0) {
      const requiredFields = new Set(fields);
      relations.forEach(rel => {
        const config = tableRelations[rel.relationName];
        if (!config) return;
        if (config.direction === 'hasMany') {
          requiredFields.add(config.localKey || 'id');
        } else if (config.fk) {
          requiredFields.add(config.fk);
        }
      });
      fields.length = 0;
      requiredFields.forEach(field => fields.push(field));
    }
    const { clause, params } = buildWhereClause(req.query as Record<string, any>, tableParam);

    let orderClause = '';
    const orderValue = normalizeQueryValue(order);
    if (orderValue) {
      const orderParts = orderValue
        .split(',')
        .map(part => part.trim())
        .filter(Boolean)
        .map(part => {
          const [field, dir] = part.split('.');
          return `${tableParam}.${field} ${dir === 'desc' ? 'DESC' : 'ASC'}`;
        });
      if (orderParts.length) {
        orderClause = `ORDER BY ${orderParts.join(', ')}`;
      }
    }

    let limitClause = '';
    const limitValue = normalizeQueryValue(limit);
    if (limitValue) {
      limitClause = `LIMIT ${parseInt(limitValue, 10)}`;
      const offsetValue = normalizeQueryValue(offset);
      if (offsetValue) {
        limitClause += ` OFFSET ${parseInt(offsetValue, 10)}`;
      }
    }

    const fieldList = fields.includes('*') ? `${tableParam}.*` : fields.map(field => `${tableParam}.${field}`).join(', ');
    const sql = `SELECT ${fieldList} FROM ${tableParam} ${clause} ${orderClause} ${limitClause}`.trim();
    const result = queryAll<any>(sql, params);

    if (result.error) {
      res.status(500).json({ error: result.error.message });
      return;
    }

    const data = result.data || [];
    await attachRelations(tableParam, data, relations);

    if (normalizeQueryValue(count) === 'exact') {
      const countResult = queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM ${tableParam} ${clause}`, params);
      res.setHeader('Content-Range', `0-${data.length}/${countResult.data?.count || 0}`);
    }

    res.json(data);
  });
});

router.get('/:table/:id', (req: AuthRequest, res: Response) => {
  const tableParam = Array.isArray(req.params.table) ? req.params.table[0] : req.params.table;
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!tableParam || !allowedTables.has(tableParam)) {
    res.status(400).json({ error: `Invalid table: ${tableParam || 'unknown'}` });
    return;
  }

  withAuth(req, res, tableParam, async () => {
    const selectValue = normalizeQueryValue(req.query.select as any) || '*';
    const { fields, relations } = parseSelect(selectValue);
    const fieldList = fields.includes('*') ? '*' : fields.join(', ');
    const result = queryOne<any>(`SELECT ${fieldList} FROM ${tableParam} WHERE id = ?`, [idParam]);

    if (result.error) {
      res.status(500).json({ error: result.error.message });
      return;
    }

    if (!result.data) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    await attachRelations(tableParam, [result.data], relations);
    res.json(result.data);
  });
});

router.post('/:table', (req: AuthRequest, res: Response) => {
  const tableParam = Array.isArray(req.params.table) ? req.params.table[0] : req.params.table;
  if (!tableParam || !allowedTables.has(tableParam)) {
    res.status(400).json({ error: `Invalid table: ${tableParam || 'unknown'}` });
    return;
  }

  withAuth(req, res, tableParam, async () => {
    // Handle batch inserts (array of records)
    if (Array.isArray(req.body)) {
      const results: any[] = [];
      for (const item of req.body) {
        const data = normalizePayload(tableParam, item || {});
        if (!data.id) {
          data.id = uuidv4();
        }

        const columns = Object.keys(data);
        const placeholders = columns.map(() => '?').join(', ');
        const values = Object.values(data);

        const sql = `INSERT INTO ${tableParam} (${columns.join(', ')}) VALUES (${placeholders})`;
        const result = execute(sql, values);

        if (result.error) {
          res.status(500).json({ error: result.error.message });
          return;
        }

        const created = queryOne<any>(`SELECT * FROM ${tableParam} WHERE id = ?`, [data.id]);
        if (created.data) {
          results.push(created.data);
          // Log activity for batch insert
          logActivity({
            table: tableParam,
            action: 'created',
            entityId: data.id,
            entityName: getEntityName(tableParam, created.data),
            userId: req.user?.id || null,
            oldValues: null,
            newValues: created.data,
            source: 'browser',
          });
        }
      }
      res.status(201).json(results);
      return;
    }

    // Handle single insert
    const data = normalizePayload(tableParam, req.body || {});
    if (!data.id) {
      data.id = uuidv4();
    }

    // For company_settings, use UPSERT since there's typically only one row
    if (tableParam === 'company_settings') {
      const tablesWithUpdatedAt = new Set(['company_settings']);
      if (tablesWithUpdatedAt.has(tableParam)) {
        data.updated_at = new Date().toISOString();
      }

      const columns = Object.keys(data);
      const placeholders = columns.map(() => '?').join(', ');
      const values = Object.values(data);
      const updateClauses = columns.filter(col => col !== 'id').map(col => `${col} = excluded.${col}`).join(', ');

      const sql = `INSERT INTO ${tableParam} (${columns.join(', ')}) VALUES (${placeholders}) 
                   ON CONFLICT(id) DO UPDATE SET ${updateClauses}`;
      const result = execute(sql, values);

      if (result.error) {
        res.status(500).json({ error: result.error.message });
        return;
      }

      const created = queryOne<any>(`SELECT * FROM ${tableParam} WHERE id = ?`, [data.id]);
      // Log activity for company_settings upsert
      if (created.data) {
        logActivity({
          table: tableParam,
          action: 'updated',
          entityId: data.id,
          entityName: getEntityName(tableParam, created.data),
          userId: req.user?.id || null,
          oldValues: null,
          newValues: created.data,
          source: 'browser',
        });
      }
      res.status(201).json(created.data);
      return;
    }

    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(', ');
    const values = Object.values(data);

    const sql = `INSERT INTO ${tableParam} (${columns.join(', ')}) VALUES (${placeholders})`;
    const result = execute(sql, values);

    if (result.error) {
      res.status(500).json({ error: result.error.message });
      return;
    }

    const created = queryOne<any>(`SELECT * FROM ${tableParam} WHERE id = ?`, [data.id]);
    // Log activity for single insert
    if (created.data) {
      logActivity({
        table: tableParam,
        action: 'created',
        entityId: data.id,
        entityName: getEntityName(tableParam, created.data),
        userId: req.user?.id || null,
        oldValues: null,
        newValues: created.data,
        source: 'browser',
      });
    }
    res.status(201).json(created.data);
  }, { write: true });
});

router.patch('/:table/:id', (req: AuthRequest, res: Response) => {
  const tableParam = Array.isArray(req.params.table) ? req.params.table[0] : req.params.table;
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!tableParam || !allowedTables.has(tableParam)) {
    res.status(400).json({ error: `Invalid table: ${tableParam || 'unknown'}` });
    return;
  }

  withAuth(req, res, tableParam, async () => {
    // Fetch old record before update for activity logging
    const oldRecord = queryOne<any>(`SELECT * FROM ${tableParam} WHERE id = ?`, [idParam]);
    
    const data = normalizePayload(tableParam, req.body || {});

    const tablesWithUpdatedAt = new Set(['clients', 'jobs', 'assets', 'items', 'invoices', 'profiles', 'issues', 'locations', 'kb_articles']);
    if (tablesWithUpdatedAt.has(tableParam)) {
      data.updated_at = new Date().toISOString();
    }

    const sets = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), idParam];

    const sql = `UPDATE ${tableParam} SET ${sets} WHERE id = ?`;
    const result = execute(sql, values);

    if (result.error) {
      res.status(500).json({ error: result.error.message });
      return;
    }

    const updated = queryOne<any>(`SELECT * FROM ${tableParam} WHERE id = ?`, [idParam]);
    // Log activity for update
    if (updated.data) {
      logActivity({
        table: tableParam,
        action: 'updated',
        entityId: idParam,
        entityName: getEntityName(tableParam, updated.data),
        userId: req.user?.id || null,
        oldValues: oldRecord.data || null,
        newValues: updated.data,
        source: 'browser',
      });
    }
    res.json(updated.data);
  }, { write: true });
});

router.patch('/:table', (req: AuthRequest, res: Response) => {
  const tableParam = Array.isArray(req.params.table) ? req.params.table[0] : req.params.table;
  if (!tableParam || !allowedTables.has(tableParam)) {
    res.status(400).json({ error: `Invalid table: ${tableParam || 'unknown'}` });
    return;
  }

  withAuth(req, res, tableParam, async () => {
    const data = normalizePayload(tableParam, req.body || {});

    const tablesWithUpdatedAt = new Set(['clients', 'jobs', 'assets', 'items', 'invoices', 'profiles', 'issues', 'locations', 'kb_articles', 'company_settings']);
    if (tablesWithUpdatedAt.has(tableParam)) {
      data.updated_at = new Date().toISOString();
    }

    const { clause, params } = buildWhereClause(req.query as Record<string, any>, tableParam);
    if (!clause) {
      res.status(400).json({ error: 'No filters specified for update' });
      return;
    }

    // Fetch old records before bulk update for activity logging
    const oldRecords = queryAll<any>(`SELECT * FROM ${tableParam} ${clause}`, params);
    const oldRecordsMap = new Map<string, any>();
    (oldRecords.data || []).forEach(record => oldRecordsMap.set(record.id, record));

    const sets = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), ...params];
    const sql = `UPDATE ${tableParam} SET ${sets} ${clause}`;
    const result = execute(sql, values);

    if (result.error) {
      res.status(500).json({ error: result.error.message });
      return;
    }

    const updated = queryAll<any>(`SELECT * FROM ${tableParam} ${clause}`, params);
    // Log activity for each updated record
    (updated.data || []).forEach(record => {
      logActivity({
        table: tableParam,
        action: 'updated',
        entityId: record.id,
        entityName: getEntityName(tableParam, record),
        userId: req.user?.id || null,
        oldValues: oldRecordsMap.get(record.id) || null,
        newValues: record,
        source: 'browser',
      });
    });
    res.json(updated.data || []);
  }, { write: true });
});

// Bulk delete with query filters (e.g., DELETE /invoice_lines?invoice_id.eq=xxx)
router.delete('/:table', (req: AuthRequest, res: Response) => {
  const tableParam = Array.isArray(req.params.table) ? req.params.table[0] : req.params.table;
  if (!tableParam || !allowedTables.has(tableParam)) {
    res.status(400).json({ error: `Invalid table: ${tableParam || 'unknown'}` });
    return;
  }

  withAuth(req, res, tableParam, async () => {
    // Build WHERE clause from query params (e.g., invoice_id.eq=xxx)
    const conditions: string[] = [];
    const params: any[] = [];
    
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value !== 'string') continue;
      
      if (key.endsWith('.eq')) {
        const column = key.slice(0, -3);
        // Only allow known safe column patterns
        if (/^[a-z_]+$/i.test(column)) {
          conditions.push(`${column} = ?`);
          params.push(value);
        }
      }
    }
    
    if (conditions.length === 0) {
      res.status(400).json({ error: 'No filter conditions specified for bulk delete' });
      return;
    }
    
    const whereClause = conditions.join(' AND ');
    
    // Fetch records before delete for activity logging
    const oldRecords = queryAll<any>(`SELECT * FROM ${tableParam} WHERE ${whereClause}`, params);
    
    const result = execute(`DELETE FROM ${tableParam} WHERE ${whereClause}`, params);

    if (result.error) {
      res.status(500).json({ error: result.error.message });
      return;
    }

    // Log activity for each deleted record
    for (const record of oldRecords.data || []) {
      logActivity({
        table: tableParam,
        action: 'deleted',
        entityId: record.id,
        entityName: getEntityName(tableParam, record),
        userId: req.user?.id || null,
        oldValues: record,
        newValues: null,
        source: 'browser',
      });
    }

    res.status(204).send();
  }, { write: true });
});

// Single record delete by ID
router.delete('/:table/:id', (req: AuthRequest, res: Response) => {
  const tableParam = Array.isArray(req.params.table) ? req.params.table[0] : req.params.table;
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!tableParam || !allowedTables.has(tableParam)) {
    res.status(400).json({ error: `Invalid table: ${tableParam || 'unknown'}` });
    return;
  }

  withAuth(req, res, tableParam, async () => {
    // Fetch record before delete for activity logging
    const oldRecord = queryOne<any>(`SELECT * FROM ${tableParam} WHERE id = ?`, [idParam]);
    
    const result = execute(`DELETE FROM ${tableParam} WHERE id = ?`, [idParam]);

    if (result.error) {
      res.status(500).json({ error: result.error.message });
      return;
    }

    // Log activity for delete
    if (oldRecord.data) {
      logActivity({
        table: tableParam,
        action: 'deleted',
        entityId: idParam,
        entityName: getEntityName(tableParam, oldRecord.data),
        userId: req.user?.id || null,
        oldValues: oldRecord.data,
        newValues: null,
        source: 'browser',
      });
    }

    res.status(204).send();
  }, { write: true });
});

router.post('/rpc/:function', (req: AuthRequest, res: Response) => {
  const { function: fn } = req.params;
  const authenticated = req.headers.authorization;
  if (!authenticated) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  switch (fn) {
    case 'is_setup_complete':
      {
        const result = queryOne<{ setup_completed: number }>('SELECT setup_completed FROM company_settings LIMIT 1');
        res.json(result.data?.setup_completed === 1);
      }
      break;
    case 'can_read':
    case 'can_write':
      {
        const { _resource_name } = req.body;
        const ignoringResult = queryOne<{ permission: string }>(
          `SELECT rp.permission
           FROM user_roles ur
           JOIN role_permissions rp ON rp.role_id = ur.role_id
           JOIN resources r ON r.id = rp.resource_id
           WHERE ur.user_id = ? AND r.name = ?`,
          [req.user?.id, _resource_name],
        );

        const permission = ignoringResult.data?.permission;
        const isWritable = permission === 'write';
        const isReadable = permission !== 'none';
        res.json(fn === 'can_write' ? isWritable : isReadable);
      }
      break;
    default:
      res.status(404).json({ error: `Unknown function: ${fn}` });
  }
});

export default router;
