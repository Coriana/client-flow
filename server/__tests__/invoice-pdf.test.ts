process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp, login } from './helpers.js';

let app: Express;
let token: string;
let clientId: string;
let invoiceAId: string;
let invoiceBId: string;

const INVOICE_A_NUMBER = 'PDF-TEST-0001';
const INVOICE_B_NUMBER = 'PDF-TEST-0002';

function auth(req: request.Test) {
  return req.set('Authorization', `Bearer ${token}`);
}

/** Buffer the raw (binary) response body so PDF bytes can be asserted on. */
function binary(req: request.Test) {
  return req.buffer(true).parse((res, callback) => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    res.on('end', () => callback(null, Buffer.concat(chunks)));
  });
}

beforeAll(async () => {
  app = await createTestApp();
  token = await login(app);

  const clientRes = await auth(request(app).post('/api/clients')).send({
    name: 'PDF Test Client',
    billing_address: '1 Test Street\nTestville QLD 4000',
  });
  expect(clientRes.status).toBe(201);
  clientId = clientRes.body.id;

  const invoiceARes = await auth(request(app).post('/api/invoices')).send({
    invoice_number: INVOICE_A_NUMBER,
    client_id: clientId,
    issue_date: '2026-07-01',
    due_date: '2026-08-01',
    subtotal: 300,
    tax_total: 30,
    total: 330,
    notes: 'Thanks for your business',
  });
  expect(invoiceARes.status).toBe(201);
  invoiceAId = invoiceARes.body.id;

  const linesRes = await auth(request(app).post('/api/invoice_lines')).send([
    {
      invoice_id: invoiceAId,
      description: 'Consulting services',
      quantity: 2,
      unit_price: 100,
      tax_rate: 10,
      line_total: 220,
      sort_order: 0,
    },
    {
      invoice_id: invoiceAId,
      description: 'On-site support',
      quantity: 1,
      unit_price: 100,
      tax_rate: 10,
      line_total: 110,
      sort_order: 1,
    },
  ]);
  expect(linesRes.status).toBe(201);

  const invoiceBRes = await auth(request(app).post('/api/invoices')).send({
    invoice_number: INVOICE_B_NUMBER,
    client_id: clientId,
    issue_date: '2026-07-05',
    due_date: '2026-08-05',
    subtotal: 50,
    tax_total: 5,
    total: 55,
  });
  expect(invoiceBRes.status).toBe(201);
  invoiceBId = invoiceBRes.body.id;

  const lineBRes = await auth(request(app).post('/api/invoice_lines')).send({
    invoice_id: invoiceBId,
    description: 'Small job',
    quantity: 1,
    unit_price: 50,
    tax_rate: 10,
    line_total: 55,
    sort_order: 0,
  });
  expect(lineBRes.status).toBe(201);
});

describe('POST /api/functions/generate-invoice-pdf', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post('/api/functions/generate-invoice-pdf')
      .send({ invoiceId: invoiceAId });
    expect(res.status).toBe(401);
  });

  it('returns 404 for an unknown invoiceId', async () => {
    const res = await auth(request(app).post('/api/functions/generate-invoice-pdf')).send({
      invoiceId: 'not-a-real-invoice-id',
    });
    expect(res.status).toBe(404);
  });

  it('returns a real PDF for a valid invoice, named after the invoice number', async () => {
    const res = await binary(
      auth(request(app).post('/api/functions/generate-invoice-pdf')).send({ invoiceId: invoiceAId })
    );

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain(INVOICE_A_NUMBER);

    const body = res.body as Buffer;
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});

describe('POST /api/functions/generate-invoices-pdf', () => {
  it('returns one combined PDF for multiple invoices, larger than a single-invoice PDF', async () => {
    const singleRes = await binary(
      auth(request(app).post('/api/functions/generate-invoice-pdf')).send({ invoiceId: invoiceAId })
    );
    expect(singleRes.status).toBe(200);
    const singleBody = singleRes.body as Buffer;

    const res = await binary(
      auth(request(app).post('/api/functions/generate-invoices-pdf')).send({
        invoiceIds: [invoiceAId, invoiceBId],
      })
    );

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');

    const body = res.body as Buffer;
    expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(body.length).toBeGreaterThan(singleBody.length);
  });

  it('returns 404 when none of the ids exist', async () => {
    const res = await auth(request(app).post('/api/functions/generate-invoices-pdf')).send({
      invoiceIds: ['nope-1', 'nope-2'],
    });
    expect(res.status).toBe(404);
  });

  it('returns 400 when invoiceIds is not an array', async () => {
    const res = await auth(request(app).post('/api/functions/generate-invoices-pdf')).send({
      invoiceIds: 'not-an-array',
    });
    expect(res.status).toBe(400);
  });
});
