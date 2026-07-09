process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp, login } from './helpers.js';

let app: Express;
let adminToken: string;

beforeAll(async () => {
  app = await createTestApp();
  adminToken = await login(app);
});

describe('security: deactivating a user immediately revokes their existing token', () => {
  it('invites + activates a user, confirms their token works, then admin disables them and the token stops working', async () => {
    const createRes = await request(app)
      .post('/api/auth/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'gets-disabled@example.com', full_name: 'Gets Disabled' });

    expect(createRes.status).toBe(200);
    const userId = createRes.body.user.id;
    const inviteToken = createRes.body.invite_token;
    expect(inviteToken).toBeTruthy();

    const acceptRes = await request(app)
      .post('/api/auth/accept-invite')
      .send({ token: inviteToken, password: 'temp-password-1' });
    expect(acceptRes.status).toBe(200);
    const userToken = acceptRes.body.token;
    expect(userToken).toBeTruthy();

    // The user's own token works on a protected route before being disabled.
    const beforeRes = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${userToken}`);
    expect(beforeRes.status).toBe(200);

    // Admin disables the account.
    const patchRes = await request(app)
      .patch(`/api/profiles/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ is_active: false });
    expect(patchRes.status).toBe(200);

    // The previously-issued token must now be rejected.
    const afterRes = await request(app)
      .get('/api/auth/session')
      .set('Authorization', `Bearer ${userToken}`);
    expect(afterRes.status).toBe(401);
    expect(afterRes.body.error).toMatch(/disabled/i);
  });
});
