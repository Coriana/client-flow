import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../db/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'local-dev-secret-change-in-production';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string | null;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, full_name: user.full_name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

// Re-loads the user from the DB and confirms the account still exists and is active.
// Single indexed lookup by primary key, so it's cheap to run on every request.
function loadActiveUser(userId: string): boolean {
  const result = queryOne<{ id: string; is_active: number }>(
    'SELECT id, is_active FROM profiles WHERE id = ?',
    [userId]
  );

  return !result.error && !!result.data && !!result.data.is_active;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.substring(7);
  const user = verifyToken(token);

  if (!user) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }

  if (!loadActiveUser(user.id)) {
    res.status(401).json({ error: 'Account is disabled' });
    return;
  }

  req.user = user;
  next();
}

export function optionalAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (user && loadActiveUser(user.id)) {
      req.user = user;
    }
  }

  next();
}

// Permission checking
export async function getUserPermission(userId: string, resourceName: string): Promise<'none' | 'read' | 'write'> {
  const result = queryOne<{ permission: string }>(`
    SELECT rp.permission
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN resources r ON r.id = rp.resource_id
    WHERE ur.user_id = ? AND r.name = ?
  `, [userId, resourceName]);

  if (result.error || !result.data) {
    return 'none';
  }

  return result.data.permission as 'none' | 'read' | 'write';
}

export function requirePermission(resource: string, action: 'read' | 'write') {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const permission = await getUserPermission(req.user.id, resource);
    
    if (permission === 'none') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    if (action === 'write' && permission === 'read') {
      res.status(403).json({ error: 'Write access denied' });
      return;
    }

    next();
  };
}
