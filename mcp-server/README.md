# clientflow-mcp

A local [MCP](https://modelcontextprotocol.io) server that lets an AI agent (Claude Desktop,
etc.) drive the **Client Flow** app through its external REST API (`/api/external`) using a
scoped API key. It exposes generic CRUD tools over every resource the external API supports.

> **Security:** this server adds no privileges. Every call is gated server-side by the API
> key's **scopes** and the owning user's **role**. Create narrowly-scoped keys at `/api-keys`
> and treat the key like a password.

## Requirements

- Node.js 18+
- A running Client Flow server
- An API key created in the app at **/api-keys**

## Build

```sh
cd mcp-server
npm install
npm run build
```

## Configuration

Two environment variables:

| Variable             | Example                       | Notes                                              |
| -------------------- | ----------------------------- | -------------------------------------------------- |
| `CLIENTFLOW_API_URL` | `http://localhost:3001/api`   | Base URL of the app (with or without trailing `/api`). |
| `CLIENTFLOW_API_KEY` | `sk_live_...`                 | An API key from `/api-keys`.                       |

The server refuses to start if either is missing (and never prints the key).

## Add to Claude Desktop

Add this to your `claude_desktop_config.json` (adjust the path to `dist/index.js`):

```json
{
  "mcpServers": {
    "clientflow": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"],
      "env": {
        "CLIENTFLOW_API_URL": "http://localhost:3001/api",
        "CLIENTFLOW_API_KEY": "sk_live_replace_me"
      }
    }
  }
}
```

## Tools

| Tool             | Purpose                                             | Hints                          |
| ---------------- | --------------------------------------------------- | ------------------------------ |
| `list_resources` | List available resources and their permission groups | read-only                      |
| `list_records`   | List records of a resource (max 100, no server filtering; use `limit`) | read-only |
| `get_record`     | Fetch one record by id                              | read-only                      |
| `create_record`  | Create a record from column/value pairs             | write                          |
| `update_record`  | Update fields on a record by id                     | write, idempotent              |
| `delete_record`  | Delete a record by id                               | write, **destructive**         |

Resources (gated by the permission group in parentheses): clients, jobs, invoices, payments,
assets, issues, vendors, items (inventory), expenses, timesheets (jobs), bank-accounts (banking),
bank-transactions (banking), profiles (team), kb-articles/kb-attachments/kb-article-issues (kb),
locations, location-contacts (locations), bill-import-sessions (purchases).

The full REST contract is documented in [`../openapi.yaml`](../openapi.yaml).

## Example prompts

- "List all active clients."
- "How many invoices are still in `draft` status?" (list invoices, filter client-side)
- "Create a new client named Acme Pty Ltd with email accounts@acme.example."
- "Create a draft invoice for client `<id>` with a total of 1500."
- "Mark invoice `<id>` as sent."

## Test

```sh
npm test   # builds, then runs the api-client unit tests with node --test
```

The tests cover URL normalization and the actionable error-message mapping (no network calls).

## Notes / limitations

- The list endpoint returns at most 100 rows and supports no server-side filtering or
  pagination — retrieve the set and filter client-side.
- `get_record` returns `null` (not an error) when no record matches the id.
