import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';
import { initializeDatabase, closeDatabase } from './db/database.js';
import authRoutes from './routes/auth.js';
import crudRoutes from './routes/crud.js';
import storageRoutes from './routes/storage.js';
import billImportRoutes from './routes/bill-import.js';
import functionsRoutes from './routes/functions.js';
import externalApiRoutes from './routes/external-api.js';
import mailRoutes from './routes/mail.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Refuse to boot in production with a missing or well-known placeholder
// JWT secret - continuing would mean anyone could forge valid session tokens.
const PLACEHOLDER_JWT_SECRETS = new Set([
  'change-me-in-production',
  'local-dev-secret-change-in-production',
  'your-secret-key',
  'your-secure-secret-key-here',
]);

if (process.env.NODE_ENV === 'production') {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || PLACEHOLDER_JWT_SECRETS.has(jwtSecret)) {
    console.error(
      'FATAL: JWT_SECRET is missing or set to a known placeholder value. ' +
      'Set a strong, unique JWT_SECRET before starting in production.'
    );
    process.exit(1);
  }

  if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*') {
    console.warn(
      'WARNING: CORS_ORIGIN is not set (or is "*") in production. ' +
      'This allows requests from any origin. Set CORS_ORIGIN to your trusted origin(s).'
    );
  }
}

const app = express();
const PORT = process.env.API_PORT || 3001;

// Rate limit authentication endpoints to slow down credential stuffing /
// brute-force attempts against login and invite acceptance.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const allowedOrigins = (process.env.CORS_ORIGIN ?? '*')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS')); // useful when debugging
  },
  credentials: true,
  optionsSuccessStatus: 204,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

// Initialize database
try {
  initializeDatabase();
} catch (error) {
  console.error('Failed to initialize database:', error);
  process.exit(1);
}

// Health check (must be before CRUD routes)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
// Rate limit only the sensitive auth actions (credential submission / invite
// acceptance). The session check is polled on every app load and focus, so
// throttling the whole /api/auth router would sign active users out.
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/accept-invite', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/bill-import', billImportRoutes);
app.use('/api/functions', functionsRoutes);
app.use('/api/external', externalApiRoutes);
app.use('/api/mail', mailRoutes);
app.use('/api', crudRoutes);

// Serve static frontend in production
if (process.env.NODE_ENV === 'production') {
  // In production with tsx, __dirname is in /app/server, dist is at /app/dist
  const distPath = join(process.cwd(), 'dist');
  console.log(`Serving static files from: ${distPath}`);
  
  app.use(express.static(distPath));
}

// SPA fallback - must be after all routes but before error handler
// This catches all unmatched GET requests and serves index.html
if (process.env.NODE_ENV === 'production') {
  const distPath = join(process.cwd(), 'dist');
  const indexPath = join(distPath, 'index.html');
  
  // Read index.html once at startup
  let indexHtml: string;
  try {
    indexHtml = readFileSync(indexPath, 'utf-8');
    console.log(`Loaded index.html (${indexHtml.length} bytes)`);
  } catch (err) {
    console.error(`Failed to read index.html from ${indexPath}:`, err);
    indexHtml = '<!DOCTYPE html><html><body>Error loading app</body></html>';
  }
  
  // 404 handler that serves SPA for non-API routes
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Check if this is an actual API route (must be /api/ not just starting with /api)
    const isApiRoute = req.path === '/api' || req.path.startsWith('/api/');
    if (req.method === 'GET' && !isApiRoute) {
      res.type('html').send(indexHtml);
    } else {
      next();
    }
  });
}

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Start server (skipped under test, where supertest drives the app directly)
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
    console.log(`Database location: ${process.env.DATABASE_PATH || join(process.cwd(), 'data', 'app.db')}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    server.close(() => {
      closeDatabase();
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down...');
    server.close(() => {
      closeDatabase();
      process.exit(0);
    });
  });
}

export default app;
