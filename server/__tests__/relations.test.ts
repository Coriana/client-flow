process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp, login } from './helpers.js';

let app: Express;
let token: string;

beforeAll(async () => {
  app = await createTestApp();
  token = await login(app);
});

function auth(req: request.Test) {
  return req.set('Authorization', `Bearer ${token}`);
}

describe('crud relation resolution (select=*, relation(...))', () => {
  it('resolves a single-level belongsTo relation unchanged (invoices -> clients)', async () => {
    const clientRes = await auth(request(app).post('/api/clients')).send({ name: 'Relation Client A' });
    expect(clientRes.status).toBe(201);
    const clientId = clientRes.body.id;

    const invoiceRes = await auth(request(app).post('/api/invoices')).send({
      invoice_number: 'REL-TEST-0001',
      client_id: clientId,
      due_date: '2026-08-01',
    });
    expect(invoiceRes.status).toBe(201);

    const listRes = await auth(request(app).get('/api/invoices')).query({ select: '*, clients(name)' });
    expect(listRes.status).toBe(200);

    const found = listRes.body.find((inv: any) => inv.id === invoiceRes.body.id);
    expect(found).toBeTruthy();
    expect(found.clients).toBeTruthy();
    expect(found.clients.name).toBe('Relation Client A');
  });

  it('resolves payments -> invoices -> clients (the headline bug: nested relation two levels deep)', async () => {
    const clientRes = await auth(request(app).post('/api/clients')).send({ name: 'Relation Client B' });
    expect(clientRes.status).toBe(201);
    const clientId = clientRes.body.id;

    const invoiceRes = await auth(request(app).post('/api/invoices')).send({
      invoice_number: 'REL-TEST-0002',
      client_id: clientId,
      due_date: '2026-08-01',
    });
    expect(invoiceRes.status).toBe(201);
    const invoiceId = invoiceRes.body.id;

    const paymentRes = await auth(request(app).post('/api/payments')).send({
      invoice_id: invoiceId,
      date: '2026-07-15',
      amount: 100,
    });
    expect(paymentRes.status).toBe(201);

    const listRes = await auth(request(app).get('/api/payments')).query({
      select: '*, invoices(invoice_number, clients(name))',
    });
    expect(listRes.status).toBe(200);

    const found = listRes.body.find((p: any) => p.id === paymentRes.body.id);
    expect(found).toBeTruthy();
    expect(found.invoices).toBeTruthy();
    expect(found.invoices.invoice_number).toBe('REL-TEST-0002');
    expect(found.invoices.clients).toBeTruthy();
    expect(found.invoices.clients.name).toBe('Relation Client B');
  });

  it('resolves a hasMany relation with a nested belongsTo (jobs -> invoices -> clients)', async () => {
    const clientRes = await auth(request(app).post('/api/clients')).send({ name: 'Relation Client C' });
    expect(clientRes.status).toBe(201);
    const clientId = clientRes.body.id;

    const jobRes = await auth(request(app).post('/api/jobs')).send({
      job_number: 'REL-JOB-0001',
      name: 'Relation Job',
      client_id: clientId,
    });
    expect(jobRes.status).toBe(201);
    const jobId = jobRes.body.id;

    const invoiceRes = await auth(request(app).post('/api/invoices')).send({
      invoice_number: 'REL-TEST-0003',
      client_id: clientId,
      job_id: jobId,
      due_date: '2026-08-01',
    });
    expect(invoiceRes.status).toBe(201);

    const listRes = await auth(request(app).get('/api/jobs')).query({
      select: '*, invoices(invoice_number, clients(name))',
    });
    expect(listRes.status).toBe(200);

    const found = listRes.body.find((j: any) => j.id === jobId);
    expect(found).toBeTruthy();
    expect(Array.isArray(found.invoices)).toBe(true);
    expect(found.invoices.length).toBe(1);
    expect(found.invoices[0].invoice_number).toBe('REL-TEST-0003');
    expect(found.invoices[0].clients).toBeTruthy();
    expect(found.invoices[0].clients.name).toBe('Relation Client C');
  });

  it('rejects an unknown relation with a 400 and a precise error message instead of silently dropping it', async () => {
    const res = await auth(request(app).get('/api/payments')).query({
      select: '*, not_a_real_relation(foo)',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(`Unknown relation 'not_a_real_relation' for table 'payments'`);
  });

  it('rejects an unknown nested relation the same way', async () => {
    const res = await auth(request(app).get('/api/payments')).query({
      select: '*, invoices(invoice_number, not_a_real_relation(foo))',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(`Unknown relation 'not_a_real_relation' for table 'invoices'`);
  });

  it('also rejects the unknown relation on the single-record GET /:table/:id route', async () => {
    const clientRes = await auth(request(app).post('/api/clients')).send({ name: 'Relation Client D' });
    expect(clientRes.status).toBe(201);

    const res = await auth(request(app).get(`/api/clients/${clientRes.body.id}`)).query({
      select: '*, not_a_real_relation(foo)',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe(`Unknown relation 'not_a_real_relation' for table 'clients'`);
  });
});
