process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp, login, SEEDED_ADMIN_EMAIL, SEEDED_ADMIN_PASSWORD } from './helpers.js';

let app: Express;

beforeAll(async () => {
  app = await createTestApp();
});

describe('auth', () => {
  it('logs in the seeded admin with the correct password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: SEEDED_ADMIN_EMAIL, password: SEEDED_ADMIN_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user?.email).toBe(SEEDED_ADMIN_EMAIL);
  });

  it('rejects login with the wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: SEEDED_ADMIN_EMAIL, password: 'definitely-wrong-password' });

    expect(res.status).toBe(401);
  });

  it('rejects POST /api/auth/users without auth', async () => {
    const res = await request(app)
      .post('/api/auth/users')
      .send({ email: 'no-auth@example.com', full_name: 'No Auth' });

    expect(res.status).toBe(401);
  });

  it('lets an admin create a user without a password and returns an invite_token', async () => {
    const token = await login(app);

    const res = await request(app)
      .post('/api/auth/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'invitee@example.com', full_name: 'Invitee' });

    expect(res.status).toBe(200);
    expect(res.body.user?.email).toBe('invitee@example.com');
    expect(res.body.invite_token).toBeTruthy();
  });

  it('refuses login for an invited-but-not-activated user, regardless of password (no passwordless takeover)', async () => {
    const token = await login(app);

    await request(app)
      .post('/api/auth/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'not-activated@example.com', full_name: 'Not Activated' });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-activated@example.com', password: 'any-password-at-all' });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/not activated/i);
  });

  it('accepts a valid invite token and returns a session token', async () => {
    const token = await login(app);

    const createRes = await request(app)
      .post('/api/auth/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'accepter@example.com', full_name: 'Accepter' });

    const inviteToken = createRes.body.invite_token;
    expect(inviteToken).toBeTruthy();

    const acceptRes = await request(app)
      .post('/api/auth/accept-invite')
      .send({ token: inviteToken, password: 'chosen-password-1' });

    expect(acceptRes.status).toBe(200);
    expect(acceptRes.body.token).toBeTruthy();
  });

  // Regression guard for a real bug: the accept-invite (and change-password)
  // handlers originally ran `UPDATE ... updated_at = datetime("now") ...` with a
  // double-quoted "now". better-sqlite3 builds SQLite with SQLITE_DQS=0, so a
  // double-quoted literal is parsed as an identifier ("no such column: now") and
  // the whole statement throws; execute() swallowed the error, so the password
  // was never persisted and login afterward always failed with "not activated".
  // Fixed by using single-quoted datetime('now'). This test proves the full
  // invite -> accept -> login round-trip works.
  it('lets a user log in with the password chosen via accept-invite', async () => {
    const token = await login(app);

    const createRes = await request(app)
      .post('/api/auth/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'accepter2@example.com', full_name: 'Accepter Two' });
    const inviteToken = createRes.body.invite_token;

    await request(app)
      .post('/api/auth/accept-invite')
      .send({ token: inviteToken, password: 'chosen-password-1' });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'accepter2@example.com', password: 'chosen-password-1' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeTruthy();
  });

  it('makes the invite token single-use (cannot be redeemed twice)', async () => {
    const token = await login(app);

    const createRes = await request(app)
      .post('/api/auth/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'accepter3@example.com', full_name: 'Accepter Three' });
    const inviteToken = createRes.body.invite_token;

    const first = await request(app)
      .post('/api/auth/accept-invite')
      .send({ token: inviteToken, password: 'chosen-password-1' });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/auth/accept-invite')
      .send({ token: inviteToken, password: 'another-password-2' });
    expect(second.status).toBe(400);
  });

  it('rejects accept-invite with a bogus token', async () => {
    const res = await request(app)
      .post('/api/auth/accept-invite')
      .send({ token: 'this-token-does-not-exist', password: 'whatever-1' });

    expect(res.status).toBe(400);
  });
});
