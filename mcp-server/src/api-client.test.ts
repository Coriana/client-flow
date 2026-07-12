import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeApiUrl,
  buildExternalBaseUrl,
  buildErrorMessage,
} from "./api-client.js";

test("normalizeApiUrl keeps a base that already ends in /api", () => {
  assert.equal(normalizeApiUrl("http://localhost:3001/api"), "http://localhost:3001/api");
});

test("normalizeApiUrl strips trailing slashes", () => {
  assert.equal(normalizeApiUrl("http://localhost:3001/api/"), "http://localhost:3001/api");
  assert.equal(normalizeApiUrl("http://localhost:3001/"), "http://localhost:3001/api");
});

test("normalizeApiUrl appends /api when missing", () => {
  assert.equal(normalizeApiUrl("http://localhost:3001"), "http://localhost:3001/api");
});

test("buildExternalBaseUrl appends /external", () => {
  assert.equal(
    buildExternalBaseUrl("http://localhost:3001/api"),
    "http://localhost:3001/api/external"
  );
  assert.equal(
    buildExternalBaseUrl("http://localhost:3001"),
    "http://localhost:3001/api/external"
  );
});

test("buildErrorMessage gives auth guidance on 401", () => {
  const msg = buildErrorMessage(401, "clients", undefined, { error: "Invalid or revoked API key" });
  assert.match(msg, /HTTP 401/);
  assert.match(msg, /Invalid or revoked API key/);
  assert.match(msg, /CLIENTFLOW_API_KEY/);
});

test("buildErrorMessage gives permission guidance on 403", () => {
  const msg = buildErrorMessage(403, "invoices", undefined, { error: "Access denied" });
  assert.match(msg, /Permission denied for 'invoices'/);
  assert.match(msg, /api-keys/);
});

test("buildErrorMessage lists available resources on invalid-resource 400", () => {
  const msg = buildErrorMessage(400, "bogus", undefined, {
    error: "Invalid resource",
    available_resources: ["clients", "jobs"],
  });
  assert.match(msg, /not a valid resource/);
  assert.match(msg, /clients, jobs/);
});

test("buildErrorMessage explains column errors on other 400s", () => {
  const msg = buildErrorMessage(400, "clients", undefined, { error: "Invalid column name" });
  assert.match(msg, /field name/);
});

test("buildErrorMessage references the id on 404", () => {
  const msg = buildErrorMessage(404, "clients", "abc-123", { error: "Record not found" });
  assert.match(msg, /No clients record found with id 'abc-123'/);
});
