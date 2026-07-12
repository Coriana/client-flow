/**
 * Thin HTTP client for the Client Flow external API
 * (`<CLIENTFLOW_API_URL>/external/...`, see server/routes/external-api.ts).
 *
 * Responsibilities:
 *  - normalize the configured base URL,
 *  - attach the Bearer auth header,
 *  - perform the fetch,
 *  - turn non-2xx responses into ClientFlowApiError with an actionable,
 *    human-readable message (so the calling tool can report it back to
 *    the agent instead of crashing the process).
 */

export interface ClientFlowConfig {
  /** Base URL that already includes the trailing "/external" segment. */
  baseUrl: string;
  apiKey: string;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiRequestOptions {
  id?: string;
  body?: unknown;
}

/**
 * Error thrown for any non-2xx response (or transport failure) from the
 * Client Flow external API. `.message` is already actionable and safe to
 * surface directly to an agent/user; `.status` is the HTTP status code
 * (0 for network-level failures where no response was received).
 */
export class ClientFlowApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ClientFlowApiError";
    this.status = status;
  }
}

/**
 * Normalizes a user-supplied CLIENTFLOW_API_URL into a base URL that ends
 * in "/api" with no trailing slash. Accepts the value with or without a
 * trailing slash, and with or without a trailing "/api":
 *
 *   "http://localhost:3001/api"   -> "http://localhost:3001/api"
 *   "http://localhost:3001/api/"  -> "http://localhost:3001/api"
 *   "http://localhost:3001"       -> "http://localhost:3001/api"
 *   "http://localhost:3001/"      -> "http://localhost:3001/api"
 */
export function normalizeApiUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  return /\/api$/i.test(trimmed) ? trimmed : `${trimmed}/api`;
}

/** Builds the full "<base>/api/external" URL used as ClientFlowConfig.baseUrl. */
export function buildExternalBaseUrl(rawApiUrl: string): string {
  return `${normalizeApiUrl(rawApiUrl)}/external`;
}

/**
 * Builds an actionable error message for a failed external API call.
 * Always includes the HTTP status and the server's raw `error` text, plus
 * guidance specific to the status code.
 */
export function buildErrorMessage(
  status: number,
  resource: string,
  id: string | undefined,
  body: any
): string {
  const serverError =
    body && typeof body.error === "string" ? body.error : "(no error detail returned)";
  const prefix = `ClientFlow API error (HTTP ${status}) for resource '${resource}': ${serverError}`;

  switch (status) {
    case 401:
      return `${prefix}. Authentication failed: the API key is missing, invalid, revoked, or expired. Check CLIENTFLOW_API_KEY.`;
    case 403:
      return `${prefix}. Permission denied for '${resource}': the API key's scopes or the owning user's role does not allow this. Grant the resource scope/permission on the key at /api-keys.`;
    case 400:
      if (Array.isArray(body?.available_resources)) {
        return `${prefix}. '${resource}' is not a valid resource. Available resources: ${body.available_resources.join(", ")}.`;
      }
      return `${prefix}. Check that every field name in your data matches an actual column on '${resource}'.`;
    case 404:
      return id
        ? `${prefix}. No ${resource} record found with id '${id}'.`
        : `${prefix}. The requested ${resource} resource was not found.`;
    default:
      return prefix;
  }
}

/**
 * Performs one call against the Client Flow external API and returns the
 * parsed `data` payload (or `null` for a 204 No Content response, e.g.
 * DELETE). Throws ClientFlowApiError on any non-2xx response or network
 * failure — callers should catch this and convert it into an MCP tool
 * error response rather than letting it propagate and crash the server.
 */
export async function apiRequest<T = any>(
  config: ClientFlowConfig,
  method: HttpMethod,
  resource: string,
  options: ApiRequestOptions = {}
): Promise<T | null> {
  const { id, body } = options;
  const path = id
    ? `${config.baseUrl}/${resource}/${encodeURIComponent(id)}`
    : `${config.baseUrl}/${resource}`;

  const hasBody = body !== undefined;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.apiKey}`,
  };
  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: hasBody ? JSON.stringify(body) : undefined,
    });
  } catch (err: any) {
    throw new ClientFlowApiError(
      `Could not reach ClientFlow API at ${path}: ${err?.message ?? err}. Check that CLIENTFLOW_API_URL points to a running server.`,
      0
    );
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  let parsed: any = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    throw new ClientFlowApiError(buildErrorMessage(response.status, resource, id, parsed), response.status);
  }

  return (parsed?.data ?? null) as T | null;
}
