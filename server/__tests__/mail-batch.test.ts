process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp, login } from './helpers.js';

/**
 * Exercises the batched invoice-send route (`POST /api/mail/send-invoices`).
 * SMTP is not configured in tests, so `sendInvoiceEmail` reports failure —
 * which is exactly what lets us assert the server LOOPS over every id and
 * reports a per-invoice outcome without needing a live mail server. The two
 * deterministic reasons ("no client email" for a client without an email,
 * "invoice not found" for an unknown id) are asserted directly.
 */
let app: Express;
let token: string;
let clientWithEmailId: string;
let clientNoEmailId: string;
let invoiceWithEmailId: string;
let invoiceNoEmailId: string;

const INVOICE_WITH_EMAIL = 'MAIL-TEST-0001';
const INVOICE_NO_EMAIL = 'MAIL-TEST-0002';

function auth(req: request.Test) {
  return req.set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => {
  app = await createTestApp();
  token = await login(app);

  const clientWithEmail = await auth(request(app).post('/api/clients')).send({
    name: 'Client With Email',
    contact_email: 'billing@withemail.example',
  });
  expect(clientWithEmail.status).toBe(201);
  clientWithEmailId = clientWithEmail.body.id;

  const clientNoEmail = await auth(request(app).post('/api/clients')).send({
    name: 'Client No Email',
  });
  expect(clientNoEmail.status).toBe(201);
  clientNoEmailId = clientNoEmail.body.id;

  const invoiceWithEmail = await auth(request(app).post('/api/invoices')).send({
    invoice_number: INVOICE_WITH_EMAIL,
    client_id: clientWithEmailId,
    issue_date: '2026-07-01',
    due_date: '2026-08-01',
    subtotal: 100,
    tax_total: 10,
    total: 110,
  });
  expect(invoiceWithEmail.status).toBe(201);
  invoiceWithEmailId = invoiceWithEmail.body.id;

  const invoiceNoEmail = await auth(request(app).post('/api/invoices')).send({
    invoice_number: INVOICE_NO_EMAIL,
    client_id: clientNoEmailId,
    issue_date: '2026-07-02',
    due_date: '2026-08-02',
    subtotal: 50,
    tax_total: 5,
    total: 55,
  });
  expect(invoiceNoEmail.status).toBe(201);
  invoiceNoEmailId = invoiceNoEmail.body.id;
});

describe('POST /api/mail/send-invoices', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post('/api/mail/send-invoices')
      .send({ invoiceIds: [invoiceWithEmailId] });
    expect(res.status).toBe(401);
  });

  it('returns 400 when invoiceIds is not an array', async () => {
    const res = await auth(request(app).post('/api/mail/send-invoices')).send({
      invoiceIds: 'not-an-array',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an empty array', async () => {
    const res = await auth(request(app).post('/api/mail/send-invoices')).send({
      invoiceIds: [],
    });
    expect(res.status).toBe(400);
  });

  it('reports "no client email" for an invoice whose client has no email', async () => {
    const res = await auth(request(app).post('/api/mail/send-invoices')).send({
      invoiceIds: [invoiceNoEmailId],
    });
    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(0);
    expect(res.body.total).toBe(1);
    expect(res.body.failures).toEqual([
      { invoiceNumber: INVOICE_NO_EMAIL, reason: 'no client email' },
    ]);
  });

  it('reports "invoice not found" for an unknown id', async () => {
    const res = await auth(request(app).post('/api/mail/send-invoices')).send({
      invoiceIds: ['does-not-exist'],
    });
    expect(res.status).toBe(200);
    expect(res.body.failures).toEqual([
      { invoiceNumber: 'does-not-exist', reason: 'invoice not found' },
    ]);
  });

  it('loops over every id, reporting one outcome per invoice', async () => {
    // With SMTP unconfigured, the invoice that HAS an email still fails to
    // send ("SMTP not configured"), but that proves the send was attempted;
    // the no-email invoice fails for its own distinct reason. Both are
    // reported, confirming the server iterates the whole list.
    const res = await auth(request(app).post('/api/mail/send-invoices')).send({
      invoiceIds: [invoiceWithEmailId, invoiceNoEmailId],
    });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.sent).toBe(0);
    expect(res.body.failed).toBe(2);

    const byNumber = Object.fromEntries(
      res.body.failures.map((f: { invoiceNumber: string; reason: string }) => [f.invoiceNumber, f.reason]),
    );
    expect(byNumber[INVOICE_NO_EMAIL]).toBe('no client email');
    expect(byNumber[INVOICE_WITH_EMAIL]).toBeDefined();
    expect(byNumber[INVOICE_WITH_EMAIL]).not.toBe('no client email');
  });
});
