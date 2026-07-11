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

describe('contacts + contact_affiliations (person-centric contacts)', () => {
  it('creates a contact, affiliates it with a client, and nests the affiliation with the client name', async () => {
    const contactRes = await auth(request(app).post('/api/contacts')).send({
      name: 'Jamie Rivera',
      email: 'jamie@example.com',
    });
    expect(contactRes.status).toBe(201);
    const contactId = contactRes.body.id;

    const clientRes = await auth(request(app).post('/api/clients')).send({ name: 'Contact Test Client' });
    expect(clientRes.status).toBe(201);
    const clientId = clientRes.body.id;

    const affiliationRes = await auth(request(app).post('/api/contact_affiliations')).send({
      contact_id: contactId,
      client_id: clientId,
      title: 'Procurement Lead',
      is_primary: true,
      start_date: '2026-01-01',
    });
    expect(affiliationRes.status).toBe(201);

    const listRes = await auth(request(app).get('/api/contacts')).query({
      select: '*, contact_affiliations(*, clients(name), vendors(name))',
    });
    expect(listRes.status).toBe(200);

    const found = listRes.body.find((c: any) => c.id === contactId);
    expect(found).toBeTruthy();
    expect(Array.isArray(found.contact_affiliations)).toBe(true);
    expect(found.contact_affiliations.length).toBe(1);

    const affiliation = found.contact_affiliations[0];
    expect(affiliation.title).toBe('Procurement Lead');
    expect(affiliation.client_id).toBe(clientId);
    expect(affiliation.clients).toBeTruthy();
    expect(affiliation.clients.name).toBe('Contact Test Client');
    // The affiliation is client-side only, so the vendors belongsTo must
    // resolve to null rather than throwing or being omitted.
    expect(affiliation.vendors).toBeNull();
  });

  it('lets a person change company: ending the client affiliation and starting a vendor one, both visible on the contact', async () => {
    const contactRes = await auth(request(app).post('/api/contacts')).send({ name: 'Morgan Lee' });
    expect(contactRes.status).toBe(201);
    const contactId = contactRes.body.id;

    const clientRes = await auth(request(app).post('/api/clients')).send({ name: 'Old Employer Pty Ltd' });
    expect(clientRes.status).toBe(201);
    const clientId = clientRes.body.id;

    const vendorRes = await auth(request(app).post('/api/vendors')).send({ name: 'New Vendor Co' });
    expect(vendorRes.status).toBe(201);
    const vendorId = vendorRes.body.id;

    const clientAffRes = await auth(request(app).post('/api/contact_affiliations')).send({
      contact_id: contactId,
      client_id: clientId,
      title: 'Account Manager',
      is_primary: true,
      start_date: '2025-01-01',
    });
    expect(clientAffRes.status).toBe(201);
    const clientAffId = clientAffRes.body.id;

    // Person changes company: end the old affiliation...
    const patchRes = await auth(request(app).patch(`/api/contact_affiliations/${clientAffId}`)).send({
      end_date: '2026-06-30',
    });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.end_date).toBe('2026-06-30');

    // ...and start a new, current one at the vendor.
    const vendorAffRes = await auth(request(app).post('/api/contact_affiliations')).send({
      contact_id: contactId,
      vendor_id: vendorId,
      title: 'Consultant',
      is_primary: true,
      start_date: '2026-07-01',
    });
    expect(vendorAffRes.status).toBe(201);

    const listRes = await auth(request(app).get('/api/contacts')).query({
      select: '*, contact_affiliations(*, clients(name), vendors(name))',
    });
    expect(listRes.status).toBe(200);

    const found = listRes.body.find((c: any) => c.id === contactId);
    expect(found).toBeTruthy();
    expect(found.contact_affiliations.length).toBe(2);

    const clientAff = found.contact_affiliations.find((a: any) => a.id === clientAffId);
    const vendorAff = found.contact_affiliations.find((a: any) => a.id === vendorAffRes.body.id);

    expect(clientAff.end_date).toBe('2026-06-30');
    expect(clientAff.clients.name).toBe('Old Employer Pty Ltd');

    expect(vendorAff.end_date).toBeNull();
    expect(vendorAff.vendors.name).toBe('New Vendor Co');
  });

  it('rejects a contact_affiliations row with both client_id and vendor_id set (CHECK constraint)', async () => {
    const contactRes = await auth(request(app).post('/api/contacts')).send({ name: 'Check Constraint Person A' });
    expect(contactRes.status).toBe(201);

    const clientRes = await auth(request(app).post('/api/clients')).send({ name: 'Check Constraint Client' });
    expect(clientRes.status).toBe(201);

    const vendorRes = await auth(request(app).post('/api/vendors')).send({ name: 'Check Constraint Vendor' });
    expect(vendorRes.status).toBe(201);

    const res = await auth(request(app).post('/api/contact_affiliations')).send({
      contact_id: contactRes.body.id,
      client_id: clientRes.body.id,
      vendor_id: vendorRes.body.id,
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.error).toMatch(/CHECK constraint failed/i);
  });

  it('rejects a contact_affiliations row with neither client_id nor vendor_id set (CHECK constraint)', async () => {
    const contactRes = await auth(request(app).post('/api/contacts')).send({ name: 'Check Constraint Person B' });
    expect(contactRes.status).toBe(201);

    const res = await auth(request(app).post('/api/contact_affiliations')).send({
      contact_id: contactRes.body.id,
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.error).toMatch(/CHECK constraint failed/i);
  });
});
