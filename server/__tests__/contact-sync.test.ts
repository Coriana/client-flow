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

describe('clients/vendors contact_* columns stay in sync with the primary contact_affiliations row', () => {
  it('sets client.contact_name/contact_email/contact_phone when a primary affiliation is created', async () => {
    const contactRes = await auth(request(app).post('/api/contacts')).send({
      name: 'Priya Nair',
      email: 'priya@example.com',
      phone: '555-1000',
    });
    expect(contactRes.status).toBe(201);
    const contactId = contactRes.body.id;

    const clientRes = await auth(request(app).post('/api/clients')).send({ name: 'Sync Test Client A' });
    expect(clientRes.status).toBe(201);
    const clientId = clientRes.body.id;

    const affRes = await auth(request(app).post('/api/contact_affiliations')).send({
      contact_id: contactId,
      client_id: clientId,
      is_primary: true,
      start_date: '2026-01-01',
    });
    expect(affRes.status).toBe(201);

    const client = await auth(request(app).get(`/api/clients/${clientId}`));
    expect(client.status).toBe(200);
    expect(client.body.contact_name).toBe('Priya Nair');
    expect(client.body.contact_email).toBe('priya@example.com');
    expect(client.body.contact_phone).toBe('555-1000');
  });

  it('clears the columns back to NULL when the primary affiliation is ended, with no other current primary', async () => {
    const contactRes = await auth(request(app).post('/api/contacts')).send({ name: 'Ending Test Person' });
    expect(contactRes.status).toBe(201);
    const contactId = contactRes.body.id;

    const clientRes = await auth(request(app).post('/api/clients')).send({ name: 'Sync Test Client B' });
    expect(clientRes.status).toBe(201);
    const clientId = clientRes.body.id;

    const affRes = await auth(request(app).post('/api/contact_affiliations')).send({
      contact_id: contactId,
      client_id: clientId,
      is_primary: true,
      start_date: '2026-01-01',
    });
    expect(affRes.status).toBe(201);
    const affId = affRes.body.id;

    let client = await auth(request(app).get(`/api/clients/${clientId}`));
    expect(client.body.contact_name).toBe('Ending Test Person');

    const endRes = await auth(request(app).patch(`/api/contact_affiliations/${affId}`)).send({
      end_date: '2026-07-01',
    });
    expect(endRes.status).toBe(200);

    client = await auth(request(app).get(`/api/clients/${clientId}`));
    expect(client.body.contact_name).toBeNull();
    expect(client.body.contact_email).toBeNull();
    expect(client.body.contact_phone).toBeNull();
  });

  it('propagates an edit to the primary contact person onto the client', async () => {
    const contactRes = await auth(request(app).post('/api/contacts')).send({
      name: 'Editable Person',
      email: 'before@example.com',
    });
    expect(contactRes.status).toBe(201);
    const contactId = contactRes.body.id;

    const clientRes = await auth(request(app).post('/api/clients')).send({ name: 'Sync Test Client C' });
    expect(clientRes.status).toBe(201);
    const clientId = clientRes.body.id;

    const affRes = await auth(request(app).post('/api/contact_affiliations')).send({
      contact_id: contactId,
      client_id: clientId,
      is_primary: true,
      start_date: '2026-01-01',
    });
    expect(affRes.status).toBe(201);

    let client = await auth(request(app).get(`/api/clients/${clientId}`));
    expect(client.body.contact_email).toBe('before@example.com');

    const patchRes = await auth(request(app).patch(`/api/contacts/${contactId}`)).send({
      email: 'after@example.com',
    });
    expect(patchRes.status).toBe(200);

    client = await auth(request(app).get(`/api/clients/${clientId}`));
    expect(client.body.contact_email).toBe('after@example.com');
    // name/phone unchanged by the email-only edit but still sourced correctly.
    expect(client.body.contact_name).toBe('Editable Person');
  });

  it('vendor equivalent: sets vendor.contact_* when a primary affiliation is created', async () => {
    const contactRes = await auth(request(app).post('/api/contacts')).send({
      name: 'Vendor Contact Person',
      email: 'vendor.person@example.com',
      phone: '555-2000',
    });
    expect(contactRes.status).toBe(201);
    const contactId = contactRes.body.id;

    const vendorRes = await auth(request(app).post('/api/vendors')).send({ name: 'Sync Test Vendor A' });
    expect(vendorRes.status).toBe(201);
    const vendorId = vendorRes.body.id;

    const affRes = await auth(request(app).post('/api/contact_affiliations')).send({
      contact_id: contactId,
      vendor_id: vendorId,
      is_primary: true,
      start_date: '2026-01-01',
    });
    expect(affRes.status).toBe(201);

    const vendor = await auth(request(app).get(`/api/vendors/${vendorId}`));
    expect(vendor.status).toBe(200);
    expect(vendor.body.contact_name).toBe('Vendor Contact Person');
    expect(vendor.body.contact_email).toBe('vendor.person@example.com');
    expect(vendor.body.contact_phone).toBe('555-2000');
  });

  it('overlapping affiliations (same person, primary at two clients at once) and a return-after-end both stay correct with no exclusivity', async () => {
    const contactRes = await auth(request(app).post('/api/contacts')).send({
      name: 'Contractor Person',
      email: 'contractor@example.com',
    });
    expect(contactRes.status).toBe(201);
    const contactId = contactRes.body.id;

    const clientDRes = await auth(request(app).post('/api/clients')).send({ name: 'Sync Test Client D' });
    const clientERes = await auth(request(app).post('/api/clients')).send({ name: 'Sync Test Client E' });
    expect(clientDRes.status).toBe(201);
    expect(clientERes.status).toBe(201);
    const clientDId = clientDRes.body.id;
    const clientEId = clientERes.body.id;

    // Primary at client D...
    const affDRes = await auth(request(app).post('/api/contact_affiliations')).send({
      contact_id: contactId,
      client_id: clientDId,
      is_primary: true,
      start_date: '2025-01-01',
    });
    expect(affDRes.status).toBe(201);

    // ...and primary at client E too, at the same time (contractor scenario).
    // Adding this must NOT end or clear the client D affiliation/primary flag.
    const affERes = await auth(request(app).post('/api/contact_affiliations')).send({
      contact_id: contactId,
      client_id: clientEId,
      is_primary: true,
      start_date: '2025-06-01',
    });
    expect(affERes.status).toBe(201);

    let clientD = await auth(request(app).get(`/api/clients/${clientDId}`));
    let clientE = await auth(request(app).get(`/api/clients/${clientEId}`));
    expect(clientD.body.contact_name).toBe('Contractor Person');
    expect(clientE.body.contact_name).toBe('Contractor Person');

    const affDCheck = await auth(request(app).get(`/api/contact_affiliations/${affDRes.body.id}`));
    expect(affDCheck.body.is_primary).toBe(1);
    expect(affDCheck.body.end_date).toBeNull();

    // Now the person leaves client D, then returns later - recorded as
    // ending the old affiliation and starting a fresh current one (rather
    // than mutating dates on the ended row), matching how the UI's "Edit"
    // dialog / re-affiliation flow works.
    const endDRes = await auth(request(app).patch(`/api/contact_affiliations/${affDRes.body.id}`)).send({
      end_date: '2025-12-31',
    });
    expect(endDRes.status).toBe(200);

    clientD = await auth(request(app).get(`/api/clients/${clientDId}`));
    expect(clientD.body.contact_name).toBeNull();
    // Client E's primary is untouched by ending the (different) client D affiliation.
    clientE = await auth(request(app).get(`/api/clients/${clientEId}`));
    expect(clientE.body.contact_name).toBe('Contractor Person');

    const returnRes = await auth(request(app).post('/api/contact_affiliations')).send({
      contact_id: contactId,
      client_id: clientDId,
      is_primary: true,
      start_date: '2026-03-01',
    });
    expect(returnRes.status).toBe(201);

    clientD = await auth(request(app).get(`/api/clients/${clientDId}`));
    expect(clientD.body.contact_name).toBe('Contractor Person');

    // Both the old (ended) and new (current) client D affiliations for this
    // person now exist side by side - no exclusivity/overwriting of history.
    const listRes = await auth(request(app).get('/api/contact_affiliations')).query({
      'contact_id.eq': contactId,
      'client_id.eq': clientDId,
    });
    expect(listRes.status).toBe(200);
    expect(listRes.body.length).toBe(2);
  });
});
