import { Router, Request, Response } from 'express';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, execute } from '../db/database.js';
import { getUserPermission } from '../middleware/auth.js';
import { logActivity, getEntityName, loggedTables } from '../utils/activityLogger.js';
import { areValidColumns } from '../db/columns.js';
import { allocateInvoiceNumber, allocateJobNumber } from '../utils/numbering.js';

const router = Router();

const RESOURCE_MAP: Record<string, { table: string; resource: string }> = {
  clients: { table: 'clients', resource: 'clients' },
  jobs: { table: 'jobs', resource: 'jobs' },
  invoices: { table: 'invoices', resource: 'invoices' },
  payments: { table: 'payments', resource: 'payments' },
  assets: { table: 'assets', resource: 'assets' },
  issues: { table: 'issues', resource: 'issues' },
  vendors: { table: 'vendors', resource: 'vendors' },
  items: { table: 'items', resource: 'inventory' },
  expenses: { table: 'expenses', resource: 'expenses' },
  timesheets: { table: 'timesheets', resource: 'jobs' },
  'bank-accounts': { table: 'bank_accounts', resource: 'banking' },
  'bank-transactions': { table: 'bank_transactions', resource: 'banking' },
  profiles: { table: 'profiles', resource: 'team' },
  'kb-articles': { table: 'kb_articles', resource: 'kb' },
  'kb-attachments': { table: 'kb_attachments', resource: 'kb' },
  'kb-article-issues': { table: 'kb_article_issues', resource: 'kb' },
  locations: { table: 'locations', resource: 'locations' },
  'location-contacts': { table: 'location_contacts', resource: 'locations' },
  'bill-import-sessions': { table: 'bill_import_sessions', resource: 'purchases' },
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function parseScopes(raw: string | null): string[] {
  if (!raw) return ['*'];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [String(parsed)];
  } catch {
    return raw.split(',').map(scope => scope.trim()).filter(Boolean);
  }
}

async function validateApiKey(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Missing or invalid Authorization header' };
  }

  const rawKey = authHeader.replace('Bearer ', '').trim();
  const hash = sha256(rawKey);

  const keyRow = queryOne<any>(
    'SELECT id, user_id, key_hash, scopes, is_active, expires_at FROM api_keys WHERE key_hash = ? LIMIT 1',
    [hash]
  ).data;

  if (!keyRow || !keyRow.is_active) {
    return { error: 'Invalid or revoked API key' };
  }

  if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
    return { error: 'API key has expired' };
  }

  return {
    apiKeyId: keyRow.id,
    userId: keyRow.user_id,
    scopes: parseScopes(keyRow.scopes),
  };
}

async function logRequest(data: {
  api_key_id: string;
  endpoint: string;
  method: string;
  status_code: number;
  response_summary?: string;
  request_body?: any;
  duration_ms?: number;
  ip_address?: string;
  user_agent?: string;
}) {
  try {
    execute(
      `INSERT INTO api_request_log (id, api_key_id, method, endpoint, status_code, request_body, response_summary, duration_ms, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        data.api_key_id,
        data.method,
        data.endpoint,
        data.status_code,
        data.request_body ? JSON.stringify(data.request_body) : null,
        data.response_summary || null,
        data.duration_ms || null,
        data.ip_address || null,
        data.user_agent || null,
      ]
    );
  } catch {
    // best effort
  }
}

const handleExternalRequest = async (req: Request, res: Response) => {
  const startTime = Date.now();
  const resourceParam = Array.isArray(req.params.resource) ? req.params.resource[0] : req.params.resource;
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (!resourceParam || !RESOURCE_MAP[resourceParam]) {
    res.status(400).json({ error: 'Invalid resource', available_resources: Object.keys(RESOURCE_MAP) });
    return;
  }

  const auth = await validateApiKey(req);
  if ('error' in auth) {
    res.status(401).json({ error: auth.error });
    return;
  }

  const { apiKeyId, userId, scopes } = auth;
  const { table, resource: permResource } = RESOURCE_MAP[resourceParam];

  if (!scopes.includes('*') && !scopes.includes(permResource)) {
    res.status(403).json({ error: 'API key does not have access to this resource' });
    return;
  }

  const permission = await getUserPermission(userId, permResource);
  const canRead = permission === 'read' || permission === 'write';
  const canWrite = permission === 'write';

  if (req.method === 'GET' && !canRead) {
    res.status(403).json({ error: 'Permission denied: no read access to this resource' });
    return;
  }

  if (req.method !== 'GET' && !canWrite) {
    res.status(403).json({ error: 'Permission denied: no write access to this resource' });
    return;
  }

  try {
    let result: any = null;
    let statusCode = 200;

    if (req.method === 'GET') {
      if (idParam) {
        result = queryOne<any>(`SELECT * FROM ${table} WHERE id = ?`, [idParam]).data;
      } else {
        result = queryAll<any>(`SELECT * FROM ${table} LIMIT 100`).data || [];
      }
    } else if (req.method === 'POST') {
      const payload = req.body || {};
      if (!payload.id) payload.id = uuidv4();
      
      // Auto-generate required fields for specific tables. Numbers come from
      // the shared, transaction-guarded counters in company_settings so they
      // never collide or get reused after a delete (see server/utils/numbering.ts).
      if (table === 'jobs' && !payload.job_number) {
        payload.job_number = allocateJobNumber();
      }

      if (table === 'invoices' && !payload.invoice_number) {
        payload.invoice_number = allocateInvoiceNumber();
      }
      
      const columns = Object.keys(payload);
      if (!areValidColumns(table, columns)) {
        res.status(400).json({ error: 'Invalid column name' });
        return;
      }
      const placeholders = columns.map(() => '?').join(', ');
      const values = Object.values(payload);
      const execResult = execute(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`, values);
      
      if (execResult.error) {
        res.status(400).json({ error: execResult.error.message });
        return;
      }
      
      result = queryOne<any>(`SELECT * FROM ${table} WHERE id = ?`, [payload.id]).data;
      statusCode = 201;
      
      // Log activity for API create
      if (result && loggedTables.has(table)) {
        logActivity({
          table,
          action: 'created',
          entityId: payload.id,
          entityName: getEntityName(table, result),
          userId,
          oldValues: null,
          newValues: result,
          source: 'api',
          apiKeyId,
        });
      }
    } else if (req.method === 'PUT' || req.method === 'PATCH') {
      if (!idParam) {
        res.status(400).json({ error: 'ID is required for update' });
        return;
      }
      // Fetch old record before update for activity logging
      const oldRecord = queryOne<any>(`SELECT * FROM ${table} WHERE id = ?`, [idParam]).data;
      
      if (!oldRecord) {
        res.status(404).json({ error: 'Record not found' });
        return;
      }
      
      const payload = req.body || {};
      const columns = Object.keys(payload);
      if (!areValidColumns(table, columns)) {
        res.status(400).json({ error: 'Invalid column name' });
        return;
      }
      const sets = columns.map(key => `${key} = ?`).join(', ');
      const values = [...Object.values(payload), idParam];
      const execResult = execute(`UPDATE ${table} SET ${sets} WHERE id = ?`, values);
      
      if (execResult.error) {
        res.status(400).json({ error: execResult.error.message });
        return;
      }
      
      result = queryOne<any>(`SELECT * FROM ${table} WHERE id = ?`, [idParam]).data;
      
      // Log activity for API update
      if (result && loggedTables.has(table)) {
        logActivity({
          table,
          action: 'updated',
          entityId: idParam,
          entityName: getEntityName(table, result),
          userId,
          oldValues: oldRecord,
          newValues: result,
          source: 'api',
          apiKeyId,
        });
      }
    } else if (req.method === 'DELETE') {
      if (!idParam) {
        res.status(400).json({ error: 'ID is required for delete' });
        return;
      }
      // Fetch record before delete for activity logging
      const oldRecord = queryOne<any>(`SELECT * FROM ${table} WHERE id = ?`, [idParam]).data;
      
      if (!oldRecord) {
        res.status(404).json({ error: 'Record not found' });
        return;
      }
      
      const execResult = execute(`DELETE FROM ${table} WHERE id = ?`, [idParam]);
      
      if (execResult.error) {
        res.status(400).json({ error: execResult.error.message });
        return;
      }
      
      result = null;
      statusCode = 204;
      
      // Log activity for API delete
      if (oldRecord && loggedTables.has(table)) {
        logActivity({
          table,
          action: 'deleted',
          entityId: idParam,
          entityName: getEntityName(table, oldRecord),
          userId,
          oldValues: oldRecord,
          newValues: null,
          source: 'api',
          apiKeyId,
        });
      }
    } else {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    await logRequest({
      api_key_id: apiKeyId,
      endpoint: `/${resourceParam}${idParam ? `/${idParam}` : ''}`,
      method: req.method,
      status_code: statusCode,
      response_summary: result ? `Success` : 'No content',
      request_body: req.method !== 'GET' ? req.body : null,
      duration_ms: Date.now() - startTime,
      ip_address: req.headers['x-forwarded-for'] as string || req.ip,
      user_agent: req.headers['user-agent'],
    });

    if (statusCode === 204) {
      res.status(204).send();
      return;
    }

    res.status(statusCode).json({ data: result });
  } catch (error: any) {
    await logRequest({
      api_key_id: apiKeyId,
      endpoint: `/${resourceParam}${idParam ? `/${idParam}` : ''}`,
      method: req.method,
      status_code: 500,
      response_summary: `Error: ${error.message}`,
      duration_ms: Date.now() - startTime,
    });
    res.status(500).json({ error: error.message });
  }
};

router.all('/:resource', handleExternalRequest);
router.all('/:resource/:id', handleExternalRequest);

export default router;
