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

describe('security: storage path traversal guards', () => {
  it('does not serve files outside the bucket via an encoded traversal path', async () => {
    const res = await request(app).get('/api/storage/images/..%2F..%2F..%2Fpackage.json');

    expect(res.status).not.toBe(200);
    expect([400, 404]).toContain(res.status);
    // Make sure we didn't accidentally leak the repo's package.json contents.
    expect(res.text || '').not.toContain('vite_react_shadcn_ts');
  });

  it('rejects an upload whose custom path tries to escape the bucket', async () => {
    const res = await request(app)
      .post('/api/storage/images')
      .set('Authorization', `Bearer ${token}`)
      .field('path', '../escape.txt')
      .attach('file', Buffer.from('malicious payload'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
  });

  it('sanity: a normal upload succeeds and the file can be fetched back', async () => {
    const uploadRes = await request(app)
      .post('/api/storage/images')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('hello world'), {
        filename: 'photo.txt',
        contentType: 'text/plain',
      });

    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.url).toBeTruthy();

    const fetchRes = await request(app).get(uploadRes.body.url);
    expect(fetchRes.status).toBe(200);
  });
});
