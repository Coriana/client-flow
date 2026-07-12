#!/usr/bin/env node
/**
 * Client Flow MCP server.
 *
 * A local Model Context Protocol server (stdio transport) that lets an AI
 * agent drive the Client Flow app through its external REST API using a
 * scoped API key. All access is ultimately gated server-side by the key's
 * scopes and the owning user's role — this server adds no privileges.
 *
 * Configuration (environment variables):
 *   CLIENTFLOW_API_URL  base URL of the app, e.g. http://localhost:3001/api
 *   CLIENTFLOW_API_KEY  an API key created at /api-keys (looks like sk_live_...)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  apiRequest,
  buildExternalBaseUrl,
  ClientFlowApiError,
  type ClientFlowConfig,
} from "./api-client.js";
import { RESOURCES, RESOURCE_PERMISSION_GROUPS, type Resource } from "./resources.js";

function loadConfig(): ClientFlowConfig {
  const rawUrl = process.env.CLIENTFLOW_API_URL;
  const apiKey = process.env.CLIENTFLOW_API_KEY;

  const missing: string[] = [];
  if (!rawUrl) missing.push("CLIENTFLOW_API_URL");
  if (!apiKey) missing.push("CLIENTFLOW_API_KEY");
  if (missing.length > 0) {
    // Never print the key itself.
    console.error(
      `clientflow-mcp: missing required environment variable(s): ${missing.join(", ")}.\n` +
        "Set CLIENTFLOW_API_URL (e.g. http://localhost:3001/api) and CLIENTFLOW_API_KEY " +
        "(an API key from /api-keys) before starting the server."
    );
    process.exit(1);
  }

  return { baseUrl: buildExternalBaseUrl(rawUrl!), apiKey: apiKey! };
}

const resourceEnum = z.enum(RESOURCES as unknown as [Resource, ...Resource[]]);

/** Wrap a tool body so a ClientFlowApiError becomes an MCP tool error instead of crashing. */
async function toToolResult(run: () => Promise<unknown>) {
  try {
    const data = await run();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    };
  } catch (err) {
    const message =
      err instanceof ClientFlowApiError
        ? err.message
        : `Unexpected error: ${(err as Error)?.message ?? String(err)}`;
    return {
      content: [{ type: "text" as const, text: message }],
      isError: true,
    };
  }
}

function createServer(config: ClientFlowConfig): McpServer {
  const server = new McpServer({ name: "clientflow-mcp", version: "0.1.0" });

  server.registerTool(
    "list_resources",
    {
      title: "List available resources",
      description:
        "List every resource this server can access and the permission group " +
        "that gates each one. Call this first to discover what you can read or write. " +
        "Actual access still depends on the API key's scopes and the owning user's role.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async () =>
      toToolResult(async () =>
        RESOURCES.map((resource) => ({
          resource,
          permission_group: RESOURCE_PERMISSION_GROUPS[resource],
        }))
      )
  );

  server.registerTool(
    "list_records",
    {
      title: "List records",
      description:
        "List records of a resource. Returns at most 100 rows; the API does not " +
        "support server-side filtering or pagination, so retrieve the set and filter " +
        "client-side. Use `limit` to cap how many rows are returned.",
      inputSchema: {
        resource: resourceEnum.describe("Which resource to list."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Maximum number of rows to return (1-100, default 100)."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ resource, limit }) =>
      toToolResult(async () => {
        const rows = (await apiRequest<any[]>(config, "GET", resource)) ?? [];
        return typeof limit === "number" ? rows.slice(0, limit) : rows;
      })
  );

  server.registerTool(
    "get_record",
    {
      title: "Get a record by id",
      description: "Fetch a single record of a resource by its id. Returns null if no such record exists.",
      inputSchema: {
        resource: resourceEnum.describe("Which resource to read."),
        id: z.string().min(1).describe("The record's id (UUID)."),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ resource, id }) =>
      toToolResult(async () => apiRequest(config, "GET", resource, { id }))
  );

  server.registerTool(
    "create_record",
    {
      title: "Create a record",
      description:
        "Create a record. `data` is an object of column/value pairs; unknown column " +
        "names are rejected. `id` is generated if omitted, and jobs/invoices get an " +
        "auto-assigned number if you omit job_number/invoice_number. Returns the created record.",
      inputSchema: {
        resource: resourceEnum.describe("Which resource to create."),
        data: z.record(z.any()).describe("Column/value pairs for the new record."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async ({ resource, data }) =>
      toToolResult(async () => apiRequest(config, "POST", resource, { body: data }))
  );

  server.registerTool(
    "update_record",
    {
      title: "Update a record",
      description:
        "Update fields on an existing record by id. `data` is an object of the " +
        "column/value pairs to change; unknown column names are rejected. Returns the updated record.",
      inputSchema: {
        resource: resourceEnum.describe("Which resource to update."),
        id: z.string().min(1).describe("The id of the record to update."),
        data: z.record(z.any()).describe("Column/value pairs to change."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ resource, id, data }) =>
      toToolResult(async () => apiRequest(config, "PATCH", resource, { id, body: data }))
  );

  server.registerTool(
    "delete_record",
    {
      title: "Delete a record",
      description: "Permanently delete a record by id. This cannot be undone.",
      inputSchema: {
        resource: resourceEnum.describe("Which resource to delete from."),
        id: z.string().min(1).describe("The id of the record to delete."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ resource, id }) =>
      toToolResult(async () => {
        await apiRequest(config, "DELETE", resource, { id });
        return { deleted: true, resource, id };
      })
  );

  return server;
}

async function main() {
  const config = loadConfig();
  const server = createServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Log to stderr so it doesn't corrupt the stdio JSON-RPC stream on stdout.
  console.error("clientflow-mcp: ready (stdio)");
}

main().catch((err) => {
  console.error("clientflow-mcp: fatal error:", err);
  process.exit(1);
});
