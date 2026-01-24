import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, execute } from '../db/database.js';
import { generateToken, authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

interface Profile {
  id: string;
  email: string;
  password_hash: string | null;
  full_name: string | null;
  is_active: number;
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

  // For first-time setup or if no password is set, allow setting a password
  if (!user.password_hash) {
    // Hash and save the password
    const hash = await bcrypt.hash(password, 10);
    execute('UPDATE profiles SET password_hash = ? WHERE id = ?', [hash, user.id]);
  } else {
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
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
  execute('UPDATE profiles SET password_hash = ?, updated_at = datetime("now") WHERE id = ?', [hash, req.user!.id]);

  res.json({ success: true });
});

// Create user (admin only)
router.post('/users', authMiddleware, async (req: AuthRequest, res: Response) => {
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

  execute(
    `INSERT INTO profiles (id, email, password_hash, full_name, is_active) 
     VALUES (?, ?, ?, ?, 1)`,
    [id, email.toLowerCase(), hash, full_name || null]
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
    }
  });
});

export default router;
