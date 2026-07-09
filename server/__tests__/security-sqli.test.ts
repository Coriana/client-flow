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

describe('security: crud column/filter validation blocks SQL injection attempts', () => {
  it('rejects an insert whose payload contains a malicious "column" key, and leaves the table intact', async () => {
    const res = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'ok', 'x = 1); DROP TABLE clients; --': 'y' });

    expect(res.status).toBe(400);

    // The table must still exist and be queryable afterwards.
    const listRes = await request(app).get('/api/clients').set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
  });

  it('rejects a bogus select column', async () => {
    const res = await request(app)
      .get('/api/clients')
      .query({ select: 'definitely_not_a_column' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('rejects a bogus filter column', async () => {
    const res = await request(app)
      .get('/api/clients')
      .query({ definitely_not_a_column: 'eq.1' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('still allows valid select/relation/filter/order queries (positive controls)', async () => {
    const createRes = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Acme Co' });
    expect(createRes.status).toBe(201);

    const selectStar = await request(app)
      .get('/api/clients')
      .query({ select: '*' })
      .set('Authorization', `Bearer ${token}`);
    expect(selectStar.status).toBe(200);

    const selectWithRelation = await request(app)
      .get('/api/clients')
      .query({ select: '*,locations(*)' })
      .set('Authorization', `Bearer ${token}`);
    expect(selectWithRelation.status).toBe(200);

    const filteredAndOrdered = await request(app)
      .get('/api/clients')
      .query({ is_active: 'eq.true', order: 'name.asc' })
      .set('Authorization', `Bearer ${token}`);
    expect(filteredAndOrdered.status).toBe(200);
  });
});
