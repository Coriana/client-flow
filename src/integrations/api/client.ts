/**
 * Local API Client - Mimics Supabase client interface
 * This allows minimal changes to existing code while using a local SQLite backend
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Token management
let authToken: string | null = localStorage.getItem('auth_token');
let authStateListeners: ((event: string, session: any) => void)[] = [];

function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
}

// Response type matching Supabase
interface ApiResponse<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
  count?: number;
}

// Query builder class that mimics Supabase's chainable API
class QueryBuilder<T = any> {
  private table: string;
  private queryParams: URLSearchParams;
  private selectFields: string = '*';
  private isSingle: boolean = false;
  private isMaybeSingle: boolean = false;
  private method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET';
  private body: any = null;
  private recordId: string | null = null;
  private countType: 'exact' | null = null;

  constructor(table: string) {
    this.table = table;
    this.queryParams = new URLSearchParams();
  }

  select(fields: string = '*', options?: { count?: 'exact' }): this {
    this.selectFields = fields;
    this.queryParams.set('select', fields);
    if (options?.count) {
      this.countType = options.count;
      this.queryParams.set('count', options.count);
    }
    return this;
  }

  insert(data: Partial<T> | Partial<T>[]): this {
    this.method = 'POST';
    this.body = data; // Support both single and batch inserts
    return this;
  }

  update(data: Partial<T>): this {
    this.method = 'PATCH';
    this.body = data;
    return this;
  }

  upsert(data: Partial<T> | Partial<T>[]): this {
    // For simplicity, treat upsert as insert (SQLite handles conflicts)
    this.method = 'POST';
    this.body = data; // Support both single and batch upserts
    return this;
  }

  delete(): this {
    this.method = 'DELETE';
    return this;
  }

  eq(column: string, value: any): this {
    if (this.method === 'PATCH' || this.method === 'DELETE') {
      if (column === 'id') {
        this.recordId = value;
      }
    }
    this.queryParams.set(`${column}.eq`, String(value));
    return this;
  }

  neq(column: string, value: any): this {
    this.queryParams.set(`${column}.neq`, String(value));
    return this;
  }

  gt(column: string, value: any): this {
    this.queryParams.set(`${column}.gt`, String(value));
    return this;
  }

  gte(column: string, value: any): this {
    this.queryParams.set(`${column}.gte`, String(value));
    return this;
  }

  lt(column: string, value: any): this {
    this.queryParams.set(`${column}.lt`, String(value));
    return this;
  }

  lte(column: string, value: any): this {
    this.queryParams.set(`${column}.lte`, String(value));
    return this;
  }

  like(column: string, pattern: string): this {
    this.queryParams.set(`${column}.like`, pattern);
    return this;
  }

  ilike(column: string, pattern: string): this {
    this.queryParams.set(`${column}.ilike`, pattern);
    return this;
  }

  is(column: string, value: null | boolean): this {
    if (value === null) {
      this.queryParams.set(`${column}.is`, 'null');
    }
    return this;
  }

  in(column: string, values: any[]): this {
    this.queryParams.set(`${column}.in`, `(${values.join(',')})`);
    return this;
  }

  or(filters: string): this {
    // Simplified OR handling - would need more complex parsing for full support
    this.queryParams.set('or', filters);
    return this;
  }

  not(column: string, operator: string, value: string): this {
    this.queryParams.set(`${column}.not.${operator}`, String(value));
    return this;
  }

  filter(column: string, operator: string, value: string): this {
    this.queryParams.set(`${column}.${operator}`, String(value));
    return this;
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): this {
    const dir = options?.ascending === false ? 'desc' : 'asc';
    const existing = this.queryParams.get('order');
    const orderStr = `${column}.${dir}`;
    this.queryParams.set('order', existing ? `${existing},${orderStr}` : orderStr);
    return this;
  }

  limit(count: number): this {
    this.queryParams.set('limit', String(count));
    return this;
  }

  range(from: number, to: number): this {
    this.queryParams.set('offset', String(from));
    this.queryParams.set('limit', String(to - from + 1));
    return this;
  }

  single(): this {
    this.isSingle = true;
    return this;
  }

  maybeSingle(): this {
    this.isMaybeSingle = true;
    return this;
  }

  async then<TResult1 = ApiResponse<T>, TResult2 = never>(
    onfulfilled?: ((value: ApiResponse<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const result = await this.execute();
    if (onfulfilled) {
      return onfulfilled(result);
    }
    return result as unknown as TResult1;
  }

  private async execute(): Promise<ApiResponse<T>> {
    try {
      let url: string;
      let options: RequestInit = {
        headers: getAuthHeaders(),
      };

      if (this.method === 'GET') {
        const queryString = this.queryParams.toString();
        url = `${API_URL}/${this.table}${queryString ? `?${queryString}` : ''}`;
        options.method = 'GET';
      } else if (this.method === 'POST') {
        url = `${API_URL}/${this.table}`;
        options.method = 'POST';
        options.body = JSON.stringify(this.body);
      } else if (this.method === 'PATCH') {
        if (this.recordId) {
          url = `${API_URL}/${this.table}/${this.recordId}`;
        } else {
          // Get ID from eq filter or fallback to filtered update
          const idEq = this.queryParams.get('id.eq');
          const queryString = this.queryParams.toString();
          if (idEq) {
            url = `${API_URL}/${this.table}/${idEq}`;
          } else if (queryString) {
            url = `${API_URL}/${this.table}?${queryString}`;
          } else {
            return { data: null, error: { message: 'No filters specified for update' } };
          }
        }
        options.method = 'PATCH';
        options.body = JSON.stringify(this.body);
      } else if (this.method === 'DELETE') {
        if (this.recordId) {
          url = `${API_URL}/${this.table}/${this.recordId}`;
        } else {
          const idEq = this.queryParams.get('id.eq');
          if (idEq) {
            url = `${API_URL}/${this.table}/${idEq}`;
          } else {
            // Support bulk delete with filters (e.g., .delete().eq('invoice_id', xxx))
            const queryString = this.queryParams.toString();
            if (queryString) {
              url = `${API_URL}/${this.table}?${queryString}`;
            } else {
              return { data: null, error: { message: 'No ID or filter specified for delete' } };
            }
          }
        }
        options.method = 'DELETE';
      } else {
        return { data: null, error: { message: 'Invalid method' } };
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        return { data: null, error: { message: errorData.error || response.statusText } };
      }

      if (this.method === 'DELETE') {
        return { data: null, error: null };
      }

      const data = await response.json();

      // Handle single/maybeSingle
      if (this.isSingle || this.isMaybeSingle) {
        if (Array.isArray(data)) {
          if (data.length === 0) {
            if (this.isSingle) {
              return { data: null, error: { message: 'No rows returned', code: 'PGRST116' } };
            }
            return { data: null, error: null };
          }
          return { data: data[0], error: null };
        }
        return { data, error: null };
      }

      // Handle count
      let count: number | undefined;
      if (this.countType === 'exact') {
        const contentRange = response.headers.get('Content-Range');
        if (contentRange) {
          const match = contentRange.match(/\/(\d+)$/);
          if (match) {
            count = parseInt(match[1], 10);
          }
        }
      }

      return { data: (Array.isArray(data) ? data : [data]) as unknown as T, error: null, count };
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } };
    }
  }
}

// Storage client
class StorageClient {
  private bucket: string;

  constructor(bucket: string) {
    this.bucket = bucket;
  }

  async upload(path: string, file: File | Blob, options?: { upsert?: boolean }): Promise<{ data: { path: string } | null; error: any }> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      // Pass the desired path/filename
      formData.append('path', path);

      const response = await fetch(`${API_URL}/storage/${this.bucket}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        return { data: null, error };
      }

      const data = await response.json();
      return { data: { path: data.path || path }, error: null };
    } catch (error) {
      return { data: null, error };
    }
  }

  async remove(paths: string[]): Promise<{ error: any }> {
    try {
      for (const path of paths) {
        // Encode the path properly for URLs
        const encodedPath = encodeURIComponent(path);
        await fetch(`${API_URL}/storage/${this.bucket}/${encodedPath}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
      }
      return { error: null };
    } catch (error) {
      return { error };
    }
  }

  getPublicUrl(path: string): { data: { publicUrl: string } } {
    // Encode the path properly for URLs
    const encodedPath = encodeURIComponent(path);
    return {
      data: {
        publicUrl: `${API_URL}/storage/${this.bucket}/${encodedPath}`,
      },
    };
  }
}

// Auth client
const auth = {
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { data: { user: null, session: null }, error: { message: error.error } };
      }

      const data = await response.json();
      setAuthToken(data.token);
      
      const session = { access_token: data.token, user: data.user };
      
      // Notify listeners
      authStateListeners.forEach(listener => listener('SIGNED_IN', session));

      return { 
        data: { 
          user: data.user, 
          session 
        }, 
        error: null 
      };
    } catch (error) {
      return { data: { user: null, session: null }, error: { message: (error as Error).message } };
    }
  },

  async signUp({ email, password, options }: { email: string; password: string; options?: { data?: { full_name?: string } } }) {
    try {
      const response = await fetch(`${API_URL}/auth/users`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          email, 
          password,
          full_name: options?.data?.full_name 
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return { data: { user: null, session: null }, error: { message: error.error } };
      }

      const data = await response.json();
      return { data: { user: data.user, session: null }, error: null };
    } catch (error) {
      return { data: { user: null, session: null }, error: { message: (error as Error).message } };
    }
  },

  async acceptInvite(token: string, password: string) {
    try {
      const response = await fetch(`${API_URL}/auth/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        return { data: { user: null, session: null }, error: { message: error.error || response.statusText } };
      }

      const data = await response.json();
      setAuthToken(data.token);

      const session = { access_token: data.token, user: data.user };

      // Notify listeners
      authStateListeners.forEach(listener => listener('SIGNED_IN', session));

      return {
        data: {
          user: data.user,
          session
        },
        error: null
      };
    } catch (error) {
      return { data: { user: null, session: null }, error: { message: (error as Error).message } };
    }
  },

  async signOut() {
    setAuthToken(null);
    authStateListeners.forEach(listener => listener('SIGNED_OUT', null));
    return { error: null };
  },

  async getSession() {
    if (!authToken) {
      return { data: { session: null }, error: null };
    }

    try {
      const response = await fetch(`${API_URL}/auth/session`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        setAuthToken(null);
        return { data: { session: null }, error: null };
      }

      const data = await response.json();
      return { 
        data: { 
          session: { 
            access_token: authToken, 
            user: data.user 
          } 
        }, 
        error: null 
      };
    } catch (error) {
      return { data: { session: null }, error: { message: (error as Error).message } };
    }
  },

  async getUser() {
    const sessionResult = await auth.getSession();
    const user = sessionResult.data.session?.user || null;
    return { data: { user }, error: null };
  },

  async resetPasswordForEmail(email: string) {
    // Not implemented for local auth - would need email service
    console.warn('Password reset not implemented for local auth');
    return { data: {}, error: null };
  },

  async updateUser(updates: { password?: string }) {
    if (updates.password) {
      try {
        const response = await fetch(`${API_URL}/auth/change-password`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ 
            currentPassword: '', // Would need to be provided
            newPassword: updates.password 
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return { data: { user: null }, error: { message: error.error } };
        }

        return { data: { user: null }, error: null };
      } catch (error) {
        return { data: { user: null }, error: { message: (error as Error).message } };
      }
    }
    return { data: { user: null }, error: null };
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    authStateListeners.push(callback);
    
    // Return unsubscribe function
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            authStateListeners = authStateListeners.filter(l => l !== callback);
          }
        }
      }
    };
  },

  // Admin namespace for Supabase compatibility
  admin: {
    async inviteUserByEmail(email: string) {
      // Deprecated: use /api/mail/send-invite instead
      console.warn('auth.admin.inviteUserByEmail is deprecated. Use /api/mail/send-invite endpoint instead.');
      return { data: null, error: { message: 'Use /api/mail/send-invite endpoint instead' } };
    }
  }
};

// RPC function caller
async function rpc<T = any>(fn: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_URL}/rpc/${fn}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(params || {}),
    });

    if (!response.ok) {
      const error = await response.json();
      return { data: null, error: { message: error.error } };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (error) {
    return { data: null, error: { message: (error as Error).message } };
  }
}

// Edge function caller
const functions = {
  async invoke(name: string, options?: { body?: any }) {
    try {
      const response = await fetch(`${API_URL}/functions/${name}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(options?.body || {}),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        return { data: null, error: { message: error.error || response.statusText } };
      }

      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } };
    }
  },
};

// Main API client export (mimics supabase)
export const supabase = {
  from: <T = any>(table: string) => new QueryBuilder<T>(table),
  auth,
  storage: {
    from: (bucket: string) => new StorageClient(bucket),
  },
  rpc,
  functions,
};

// Also export as api for explicit usage
export const api = supabase;
