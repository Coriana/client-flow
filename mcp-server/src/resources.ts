/**
 * The fixed set of resources exposed by the Client Flow external API
 * (mirrors RESOURCE_MAP in server/routes/external-api.ts of the main app).
 *
 * This list is intentionally hardcoded rather than discovered at runtime:
 * the external API has no "list resources" endpoint of its own, and a
 * static, typed union gives the agent (and Zod) a closed set to validate
 * against instead of an arbitrary string.
 */
export const RESOURCES = [
  "clients",
  "jobs",
  "invoices",
  "payments",
  "assets",
  "issues",
  "vendors",
  "items",
  "expenses",
  "timesheets",
  "bank-accounts",
  "bank-transactions",
  "profiles",
  "kb-articles",
  "kb-attachments",
  "kb-article-issues",
  "locations",
  "location-contacts",
  "bill-import-sessions",
] as const;

export type Resource = (typeof RESOURCES)[number];

/**
 * Maps each resource to the permission group that gates it server-side.
 * A request against a resource is only allowed when:
 *   1. the API key's scopes include "*" or this permission group, AND
 *   2. the key's owning user has read/write permission for this group.
 *
 * Mirrors the `resource` field of RESOURCE_MAP in
 * server/routes/external-api.ts. Several resources intentionally share a
 * group (e.g. timesheets is gated by the "jobs" permission, bank-accounts
 * and bank-transactions both fall under "banking").
 */
export const RESOURCE_PERMISSION_GROUPS: Record<Resource, string> = {
  clients: "clients",
  jobs: "jobs",
  invoices: "invoices",
  payments: "payments",
  assets: "assets",
  issues: "issues",
  vendors: "vendors",
  items: "inventory",
  expenses: "expenses",
  timesheets: "jobs",
  "bank-accounts": "banking",
  "bank-transactions": "banking",
  profiles: "team",
  "kb-articles": "kb",
  "kb-attachments": "kb",
  "kb-article-issues": "kb",
  locations: "locations",
  "location-contacts": "locations",
  "bill-import-sessions": "purchases",
};
