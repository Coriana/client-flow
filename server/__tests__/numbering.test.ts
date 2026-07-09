process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp, login } from './helpers.js';
import type { allocateInvoiceNumber as AllocateInvoiceNumberFn } from '../utils/numbering.js';
import type { queryOne as QueryOneFn } from '../db/database.js';

let app: Express;
let adminToken: string;
let clientId: string;
let allocateInvoiceNumber: typeof AllocateInvoiceNumberFn;
let queryOne: typeof QueryOneFn;

function numericSuffix(value: string): number {
  return parseInt(value.replace(/\D/g, ''), 10);
}

beforeAll(async () => {
  // createTestApp() sets DATABASE_PATH and dynamically imports the app so that
  // `initializeDatabase()` runs against a fresh temp DB. server/db/database.ts
  // freezes its DB_PATH constant at module-evaluation time, so ../db/database.js
  // (and anything that imports it, like ../utils/numbering.js) must ALSO be
  // imported dynamically, and only after createTestApp() has run - a static
  // top-level `import` here would be hoisted ahead of the env var assignment
  // and permanently bind to the wrong (non-temp) database path.
  app = await createTestApp();
  ({ allocateInvoiceNumber } = await import('../utils/numbering.js'));
  ({ queryOne } = await import('../db/database.js'));

  adminToken = await login(app);

  const clientRes = await request(app)
    .post('/api/clients')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'Numbering Test Client' });
  expect(clientRes.status).toBe(201);
  clientId = clientRes.body.id;
});

describe('invoice/job numbering', () => {
  it('allocateInvoiceNumber() returns sequential numbers and advances invoice_next_number', () => {
    const before = queryOne<{ invoice_next_number: number }>(
      'SELECT invoice_next_number FROM company_settings LIMIT 1'
    ).data;
    expect(before).toBeTruthy();

    const first = allocateInvoiceNumber();
    const second = allocateInvoiceNumber();

    expect(first).not.toBe(second);
    expect(numericSuffix(second)).toBe(numericSuffix(first) + 1);

    const after = queryOne<{ invoice_next_number: number }>(
      'SELECT invoice_next_number FROM company_settings LIMIT 1'
    ).data;
    expect(after!.invoice_next_number).toBe(before!.invoice_next_number + 2);
  });

  it('does not reuse an invoice number after the invoice using it is deleted', async () => {
    const numA = allocateInvoiceNumber();

    const createRes = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ invoice_number: numA, client_id: clientId, due_date: '2026-08-01' });
    expect(createRes.status).toBe(201);
    const invoiceId = createRes.body.id;

    const deleteRes = await request(app)
      .delete(`/api/invoices/${invoiceId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(204);

    // With the old COUNT(*)-based scheme, deleting the only invoice would drop
    // COUNT(*) back down and the "next" number would collide with numA. The
    // counter-based allocator must not be affected by row deletions at all.
    const numB = allocateInvoiceNumber();
    expect(numB).not.toBe(numA);
    expect(numericSuffix(numB)).toBeGreaterThan(numericSuffix(numA));
  });

  it('POST /api/functions/allocate-invoice-number returns distinct numbers across calls', async () => {
    const res1 = await request(app)
      .post('/api/functions/allocate-invoice-number')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res1.status).toBe(200);
    expect(res1.body.invoice_number).toBeTruthy();

    const res2 = await request(app)
      .post('/api/functions/allocate-invoice-number')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res2.status).toBe(200);
    expect(res2.body.invoice_number).toBeTruthy();

    expect(res1.body.invoice_number).not.toBe(res2.body.invoice_number);
  });

  it('POST /api/functions/allocate-job-number returns distinct numbers across calls', async () => {
    const res1 = await request(app)
      .post('/api/functions/allocate-job-number')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res1.status).toBe(200);
    expect(res1.body.job_number).toBeTruthy();

    const res2 = await request(app)
      .post('/api/functions/allocate-job-number')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res2.status).toBe(200);
    expect(res2.body.job_number).toBeTruthy();

    expect(res1.body.job_number).not.toBe(res2.body.job_number);
  });

  it('the external API assigns distinct, non-colliding invoice_numbers, even across a delete (regression for the old COUNT(*) scheme)', async () => {
    const keyRes = await request(app)
      .post('/api/auth/api-keys')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'numbering-test-key', scopes: ['*'] });
    expect(keyRes.status).toBe(200);
    const rawKey = keyRes.body.key;
    expect(rawKey).toBeTruthy();

    const create1 = await request(app)
      .post('/api/external/invoices')
      .set('Authorization', `Bearer ${rawKey}`)
      .send({ client_id: clientId, due_date: '2026-08-01' });
    expect(create1.status).toBe(201);
    const number1 = create1.body.data.invoice_number;
    const id1 = create1.body.data.id;
    expect(number1).toBeTruthy();

    const create2 = await request(app)
      .post('/api/external/invoices')
      .set('Authorization', `Bearer ${rawKey}`)
      .send({ client_id: clientId, due_date: '2026-08-01' });
    expect(create2.status).toBe(201);
    const number2 = create2.body.data.invoice_number;
    expect(number2).toBeTruthy();
    expect(number2).not.toBe(number1);

    // Delete the first invoice: COUNT(*) would now drop back down under the old
    // scheme, but the allocator must not reissue a number already handed out.
    const delRes = await request(app)
      .delete(`/api/external/invoices/${id1}`)
      .set('Authorization', `Bearer ${rawKey}`);
    expect(delRes.status).toBe(204);

    const create3 = await request(app)
      .post('/api/external/invoices')
      .set('Authorization', `Bearer ${rawKey}`)
      .send({ client_id: clientId, due_date: '2026-08-01' });
    expect(create3.status).toBe(201);
    const number3 = create3.body.data.invoice_number;

    expect(number3).not.toBe(number1);
    expect(number3).not.toBe(number2);
  });

  it('rejects inserting two invoices with the same explicit invoice_number (UNIQUE backstop)', async () => {
    const dupNumber = 'DUP-TEST-0001';

    const first = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ invoice_number: dupNumber, client_id: clientId, due_date: '2026-08-01' });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ invoice_number: dupNumber, client_id: clientId, due_date: '2026-08-01' });

    expect(second.status).toBeGreaterThanOrEqual(400);
    expect(second.body.error).toBeTruthy();
  });
});
