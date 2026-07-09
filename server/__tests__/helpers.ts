import os from 'os';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import request from 'supertest';
import type { Express } from 'express';

export const SEEDED_ADMIN_EMAIL = 'admin@localhost';
export const SEEDED_ADMIN_PASSWORD = 'admin123';

/**
 * Creates a unique, isolated environment (temp DATABASE_PATH + UPLOAD_DIR)
 * and dynamically imports the Express app so that `initializeDatabase()`
 * runs against the freshly-set env vars. The dynamic import must happen
 * AFTER the env vars are assigned, which is why the import lives inside
 * this function rather than as a static top-level import.
 *
 * The database is a singleton keyed off DATABASE_PATH at first
 * `getDatabase()` call, so every test file must call this (once, in its
 * own `beforeAll`) with its own random temp dir to avoid cross-file state
 * leakage.
 */
export async function createTestApp(): Promise<Express> {
  const tempDir = path.join(
    os.tmpdir(),
    `cff-test-${process.pid}-${crypto.randomBytes(6).toString('hex')}`,
  );
  fs.mkdirSync(tempDir, { recursive: true });

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key';
  process.env.DATABASE_PATH = path.join(tempDir, 'test.db');
  process.env.UPLOAD_DIR = path.join(tempDir, 'uploads');

  const { default: app } = await import('../index.js');
  return app;
}

/**
 * Logs in (defaults to the seeded admin) and returns the bearer token.
 * Throws if the login does not succeed, so test setup fails loudly.
 */
export async function login(
  app: Express,
  email: string = SEEDED_ADMIN_EMAIL,
  password: string = SEEDED_ADMIN_PASSWORD,
): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200 || !res.body?.token) {
    throw new Error(`login() failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.token as string;
}
