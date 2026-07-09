import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, execute } from '../db/database.js';
import { generateToken, authMiddleware, AuthRequest, requirePermission, getUserPermission } from '../middleware/auth.js';

const router = Router();

const INVITE_TOKEN_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

interface Profile {
  id: string;
  email: string;
  password_hash: string | null;
  full_name: string | null;
  is_active: number;
}

interface ProfileWithInvite extends Profile {
  invite_token: string | null;
  invite_expires_at: string | null;
}

// Login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const result = queryOne<Profile>(
    'SELECT id, email, password_hash, full_name, is_active FROM profiles WHERE email = ?',
    [email.toLowerCase()]
  );

  if (result.error) {
    res.status(500).json({ error: 'Database error' });
    return;
  }

  if (!result.data) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const user = result.data;

  if (!user.is_active) {
    res.status(401).json({ error: 'Account is disabled' });
    return;
  }

  // Accounts without a password hash have not been activated yet (invite pending).
  // Do NOT auto-set a password here - that would let anyone who knows the email
  // claim the account. They must go through /auth/accept-invite instead.
  if (!user.password_hash) {
    res.status(401).json({ error: 'Account not activated. Use your invitation link to set a password.' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = generateToken({
    id: user.id,
    email: user.email,
    full_name: user.full_name
  });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name
    }
  });
});

// Get current session
router.get('/session', authMiddleware, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

// Logout (client-side, just acknowledge)
router.post('/logout', (req: Request, res: Response) => {
  res.json({ success: true });
});

// Change password
router.post('/change-password', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current and new passwords are required' });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  const result = queryOne<Profile>(
    'SELECT id, password_hash FROM profiles WHERE id = ?',
    [req.user!.id]
  );

  if (result.error || !result.data) {
    res.status(500).json({ error: 'Database error' });
    return;
  }

  if (result.data.password_hash) {
    const valid = await bcrypt.compare(currentPassword, result.data.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }
  }

  const hash = await bcrypt.hash(newPassword, 10);
  execute(`UPDATE profiles SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`, [hash, req.user!.id]);

  res.json({ success: true });
});

// Create user (requires team:write permission)
router.post('/users', authMiddleware, async (req: AuthRequest, res: Response) => {
  const requireWrite = requirePermission('team', 'write');
  await requireWrite(req, res, async () => {
    const { email, full_name, password, role_id } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    // Check if email already exists
    const existing = queryOne('SELECT id FROM profiles WHERE email = ?', [email.toLowerCase()]);
    if (existing.data) {
      res.status(400).json({ error: 'Email already exists' });
      return;
    }

    const id = uuidv4();
    const hash = password ? await bcrypt.hash(password, 10) : null;

    // If no password was provided, generate an invite token so the user can
    // activate their account via /auth/accept-invite instead of relying on
    // a passwordless first login.
    let inviteToken: string | null = null;
    let inviteExpiresAt: string | null = null;
    if (!hash) {
      inviteToken = randomBytes(32).toString('hex');
      inviteExpiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_MS).toISOString();
    }

    execute(
      `INSERT INTO profiles (id, email, password_hash, full_name, is_active, invite_token, invite_expires_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`,
      [id, email.toLowerCase(), hash, full_name || null, inviteToken, inviteExpiresAt]
    );

    // Assign role if provided
    if (role_id) {
      execute(
        `INSERT INTO user_roles (id, user_id, role_id, role) VALUES (?, ?, ?, 'staff')`,
        [uuidv4(), id, role_id]
      );
    }

    res.json({
      user: {
        id,
        email: email.toLowerCase(),
        full_name: full_name || null
      },
      ...(inviteToken ? { invite_token: inviteToken } : {})
    });
  });
});

// Accept an invitation: set a password using a valid invite token, then auto-login.
router.post('/accept-invite', async (req: Request, res: Response) => {
  const { token, password } = req.body;

  if (!token || !password) {
    res.status(400).json({ error: 'Token and password are required' });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  const result = queryOne<ProfileWithInvite>(
    'SELECT id, email, password_hash, full_name, is_active, invite_token, invite_expires_at FROM profiles WHERE invite_token = ?',
    [token]
  );

  if (result.error || !result.data) {
    res.status(400).json({ error: 'Invalid or expired invitation' });
    return;
  }

  const profile = result.data;

  if (!profile.invite_expires_at || new Date(profile.invite_expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: 'Invalid or expired invitation' });
    return;
  }

  const hash = await bcrypt.hash(password, 10);
  execute(
    `UPDATE profiles SET password_hash = ?, invite_token = NULL, invite_expires_at = NULL, updated_at = datetime('now') WHERE id = ?`,
    [hash, profile.id]
  );

  const authToken = generateToken({
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name
  });

  res.json({
    token: authToken,
    user: {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name
    }
  });
});

// Create API key (server-side key generation)
router.post('/api-keys', authMiddleware, async (req: AuthRequest, res: Response) => {
  const requireWrite = requirePermission('settings', 'write');
  await requireWrite(req, res, async () => {
    const { name, scopes, expires_at, user_id } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Key name is required' });
      return;
    }

    // Generate a secure random key
    const prefix = 'sk_live_';
    const randomPart = randomBytes(24).toString('base64url');
    const rawKey = prefix + randomPart;

    // Hash the key for storage
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 12);

    const id = uuidv4();

    // Never trust body.user_id blindly - it would let any authenticated user
    // mint a key for someone else. Only honor it if the requester has
    // team:write permission; otherwise the key is always scoped to themselves.
    let keyUserId = req.user!.id;
    if (user_id && user_id !== req.user!.id) {
      const teamPermission = await getUserPermission(req.user!.id, 'team');
      if (teamPermission === 'write') {
        keyUserId = user_id;
      }
    }

    try {
      execute(
        `INSERT INTO api_keys (id, name, key_hash, key_prefix, scopes, expires_at, user_id, created_by, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          id,
          name,
          keyHash,
          keyPrefix,
          JSON.stringify(scopes || ['*']),
          expires_at || null,
          keyUserId,
          req.user!.id
        ]
      );

      // Return the raw key - this is the only time it will be shown
      res.json({
        id,
        name,
        key: rawKey,
        key_prefix: keyPrefix,
        scopes: scopes || ['*'],
        expires_at: expires_at || null,
        user_id: keyUserId
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to create API key' });
    }
  });
});

export default router;
