import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Supported resources and their table mappings
const RESOURCE_MAP: Record<string, { table: string; resource: string }> = {
  'clients': { table: 'clients', resource: 'clients' },
  'jobs': { table: 'jobs', resource: 'jobs' },
  'invoices': { table: 'invoices', resource: 'invoices' },
  'payments': { table: 'payments', resource: 'payments' },
  'assets': { table: 'assets', resource: 'assets' },
  'issues': { table: 'issues', resource: 'issues' },
  'vendors': { table: 'vendors', resource: 'vendors' },
  'items': { table: 'items', resource: 'items' },
  'expenses': { table: 'expenses', resource: 'expenses' },
  'timesheets': { table: 'timesheets', resource: 'timesheets' },
  'bank-accounts': { table: 'bank_accounts', resource: 'banking' },
  'bank-transactions': { table: 'bank_transactions', resource: 'banking' },
  'profiles': { table: 'profiles', resource: 'team' },
  'kb-articles': { table: 'kb_articles', resource: 'knowledge_base' },
  'kb-attachments': { table: 'kb_attachments', resource: 'knowledge_base' },
  'kb-article-issues': { table: 'kb_article_issues', resource: 'knowledge_base' },
  'locations': { table: 'locations', resource: 'locations' },
  'location-contacts': { table: 'location_contacts', resource: 'locations' },
  'bill-import-sessions': { table: 'bill_import_sessions', resource: 'payments' },
};

interface ApiKeyValidation {
  key_user_id: string;
  key_api_key_id: string;
  key_scopes: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  
  // Expected path: /api/v1/{resource}/{id?}
  // After edge function routing: /{resource}/{id?}
  const resource = pathParts[0];
  const id = pathParts[1];

  // Initialize Supabase admin client for logging
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let apiKeyId: string | null = null;
  let userId: string | null = null;

  try {
    // Extract API key from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = authHeader.replace('Bearer ', '');

    // Validate API key using the database function
    const { data: keyData, error: keyError } = await supabaseAdmin
      .rpc('validate_api_key', { raw_key: apiKey });

    if (keyError || !keyData || keyData.length === 0) {
      console.error('API key validation failed:', keyError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation: ApiKeyValidation = keyData[0];
    apiKeyId = validation.key_api_key_id;
    userId = validation.key_user_id;
    const scopes = validation.key_scopes || [];

    // Check if resource is valid
    if (!resource || !RESOURCE_MAP[resource]) {
      const availableResources = Object.keys(RESOURCE_MAP);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid resource', 
          available_resources: availableResources,
          documentation: 'Use GET /api/{resource} to list, POST to create, PUT/DELETE with /{id}'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { table, resource: permResource } = RESOURCE_MAP[resource];

    // Check scopes if defined
    if (scopes.length > 0 && !scopes.includes(permResource) && !scopes.includes('*')) {
      return new Response(
        JSON.stringify({ error: 'API key does not have access to this resource' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check user permissions using the permission functions
    const isReadOperation = req.method === 'GET';
    const permissionCheck = isReadOperation ? 'can_read' : 'can_write';
    
    const { data: hasPermission } = await supabaseAdmin
      .rpc(permissionCheck, { _resource_name: permResource })
      .setHeader('Authorization', `Bearer ${await createUserToken(supabaseAdmin, userId)}`);

    // For API keys, we check permissions differently - use service role but verify against user's role
    const { data: userPermission } = await supabaseAdmin
      .rpc('get_user_permission', { _user_id: userId, _resource_name: permResource });

    const canRead = userPermission === 'read' || userPermission === 'write';
    const canWrite = userPermission === 'write';

    if (isReadOperation && !canRead) {
      return new Response(
        JSON.stringify({ error: 'Permission denied: no read access to this resource' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isReadOperation && !canWrite) {
      return new Response(
        JSON.stringify({ error: 'Permission denied: no write access to this resource' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: any;
    let statusCode = 200;

    switch (req.method) {
      case 'GET':
        result = await handleGet(supabaseAdmin, table, id, url.searchParams);
        break;
      case 'POST':
        if (id) {
          return new Response(
            JSON.stringify({ error: 'POST requests should not include an ID' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const createBody = await req.json();
        result = await handleCreate(supabaseAdmin, table, createBody);
        statusCode = 201;
        break;
      case 'PUT':
      case 'PATCH':
        if (!id) {
          return new Response(
            JSON.stringify({ error: 'PUT/PATCH requests require an ID' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        const updateBody = await req.json();
        result = await handleUpdate(supabaseAdmin, table, id, updateBody);
        break;
      case 'DELETE':
        if (!id) {
          return new Response(
            JSON.stringify({ error: 'DELETE requests require an ID' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        result = await handleDelete(supabaseAdmin, table, id);
        statusCode = 204;
        break;
      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Log the request
    const duration = Date.now() - startTime;
    await logRequest(supabaseAdmin, {
      api_key_id: apiKeyId,
      endpoint: `/${resource}${id ? '/' + id : ''}`,
      method: req.method,
      status_code: statusCode,
      request_body: req.method !== 'GET' ? await safeParseBody(req) : null,
      response_summary: result.error ? result.error : `Success: ${result.data?.length || 1} records`,
      ip_address: req.headers.get('x-forwarded-for') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
      duration_ms: duration,
    });

    if (result.error) {
      return new Response(
        JSON.stringify({ error: result.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (statusCode === 204) {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    return new Response(
      JSON.stringify({
        data: result.data,
        meta: result.meta || {},
      }),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('API Error:', errorMessage);
    
    // Log error
    if (apiKeyId) {
      const duration = Date.now() - startTime;
      await logRequest(supabaseAdmin, {
        api_key_id: apiKeyId,
        endpoint: `/${resource}${id ? '/' + id : ''}`,
        method: req.method,
        status_code: 500,
        response_summary: `Error: ${errorMessage}`,
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown',
        duration_ms: duration,
      });
    }

    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleGet(supabase: any, table: string, id: string | undefined, params: URLSearchParams) {
  let query = supabase.from(table).select('*', { count: 'exact' });

  if (id) {
    // Single record
    const { data, error } = await query.eq('id', id).single();
    if (error) return { error: error.message };
    return { data };
  }

  // List with pagination
  const limit = parseInt(params.get('limit') || '25');
  const offset = parseInt(params.get('offset') || '0');
  const sort = params.get('sort') || 'created_at';
  const order = params.get('order') || 'desc';

  query = query
    .order(sort, { ascending: order === 'asc' })
    .range(offset, offset + limit - 1);

  // Apply filters (e.g., ?filter[status]=active)
  for (const [key, value] of params.entries()) {
    if (key.startsWith('filter[') && key.endsWith(']')) {
      const field = key.slice(7, -1);
      query = query.eq(field, value);
    }
  }

  const { data, error, count } = await query;
  if (error) return { error: error.message };

  return {
    data,
    meta: {
      total: count,
      limit,
      offset,
      has_more: (offset + limit) < (count || 0),
    },
  };
}

async function handleCreate(supabase: any, table: string, body: any) {
  const { data, error } = await supabase
    .from(table)
    .insert(body)
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}

async function handleUpdate(supabase: any, table: string, id: string, body: any) {
  const { data, error } = await supabase
    .from(table)
    .update(body)
    .eq('id', id)
    .select()
    .single();

  if (error) return { error: error.message };
  return { data };
}

async function handleDelete(supabase: any, table: string, id: string) {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id);

  if (error) return { error: error.message };
  return { data: null };
}

async function logRequest(supabase: any, log: any) {
  try {
    await supabase.from('api_request_log').insert(log);
  } catch (e) {
    console.error('Failed to log API request:', e);
  }
}

async function safeParseBody(req: Request): Promise<any> {
  try {
    const clone = req.clone();
    return await clone.json();
  } catch {
    return null;
  }
}

// Helper to create a user-context token (not implemented - using service role with permission check)
async function createUserToken(supabase: any, userId: string): Promise<string> {
  // This is a placeholder - in production you might want to create a short-lived token
  // For now, we validate permissions using get_user_permission function
  return '';
}
