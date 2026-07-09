import { Router, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { join, extname, dirname, resolve, sep } from 'path';
import { existsSync, mkdirSync, unlinkSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

/** Express route params can be typed string | string[]; take the first value. */
function asParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : (value ?? '');
}

const router = Router();

// Configure storage
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'server', 'uploads');

/**
 * Resolve a caller-supplied relative path inside a bucket, guaranteeing the
 * result cannot escape the bucket directory. Returns null if it would.
 */
function resolveWithinBucket(bucket: string, relPath: string): string | null {
  const bucketRoot = resolve(UPLOAD_DIR, bucket);
  const full = resolve(bucketRoot, relPath);
  if (full !== bucketRoot && !full.startsWith(bucketRoot + sep)) {
    return null;
  }
  return full;
}

// Ensure upload directories exist
const buckets = ['images', 'documents', 'kb-files', 'branding'];
for (const bucket of buckets) {
  const dir = join(UPLOAD_DIR, bucket);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

// Configure multer for file uploads - use memory storage to handle custom paths
const memoryStorage = multer.memoryStorage();

// Also keep disk storage for simple uploads
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const bucket = asParam(req.params.bucket);
    if (!buckets.includes(bucket)) {
      cb(new Error('Invalid bucket'), '');
      return;
    }
    cb(null, join(UPLOAD_DIR, bucket));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'image/x-icon', 'image/vnd.microsoft.icon',
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv',
      'application/zip', 'application/x-rar-compressed',
      'application/octet-stream' // Allow generic binary files
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  }
});

// Upload file to bucket
router.post('/:bucket', authMiddleware, upload.single('file'), (req: AuthRequest, res: Response) => {
  const bucket = asParam(req.params.bucket);

  if (!buckets.includes(bucket)) {
    res.status(400).json({ error: 'Invalid bucket' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: 'No file provided' });
    return;
  }

  // Get custom path from form data, or generate a unique name
  let filePath = req.body.path;
  if (!filePath) {
    filePath = `${uuidv4()}${extname(req.file.originalname)}`;
  }

  // Ensure the resolved write location stays inside the bucket directory
  const fullPath = resolveWithinBucket(bucket, filePath);
  if (!fullPath) {
    res.status(400).json({ error: 'Invalid path' });
    return;
  }

  // Ensure the directory exists
  const fullDir = dirname(fullPath);
  if (!existsSync(fullDir)) {
    mkdirSync(fullDir, { recursive: true });
  }

  // Write the file
  writeFileSync(fullPath, req.file.buffer);

  const fileUrl = `/api/storage/${bucket}/${encodeURIComponent(filePath)}`;
  
  res.json({
    path: filePath,
    fullPath: `${bucket}/${filePath}`,
    url: fileUrl,
    size: req.file.size,
    mimetype: req.file.mimetype,
    originalName: req.file.originalname
  });
});

// Get file from bucket (simple filename)
router.get('/:bucket/:filename', (req, res) => {
  const bucket = asParam(req.params.bucket);
  const filename = asParam(req.params.filename);

  if (!buckets.includes(bucket)) {
    res.status(400).json({ error: 'Invalid bucket' });
    return;
  }

  const filePath = resolveWithinBucket(bucket, filename);
  if (!filePath) {
    res.status(400).json({ error: 'Invalid path' });
    return;
  }

  if (!existsSync(filePath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  res.sendFile(filePath);
});

// Delete file from bucket
router.delete('/:bucket/:filename', authMiddleware, (req: AuthRequest, res: Response) => {
  const bucket = asParam(req.params.bucket);
  const filename = asParam(req.params.filename);

  if (!buckets.includes(bucket)) {
    res.status(400).json({ error: 'Invalid bucket' });
    return;
  }

  const filePath = resolveWithinBucket(bucket, filename);
  if (!filePath) {
    res.status(400).json({ error: 'Invalid path' });
    return;
  }

  if (!existsSync(filePath)) {
    // File doesn't exist, but that's fine for delete
    res.status(204).send();
    return;
  }

  try {
    unlinkSync(filePath);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// List files in bucket
router.get('/:bucket', authMiddleware, (req: AuthRequest, res: Response) => {
  const bucket = asParam(req.params.bucket);

  if (!buckets.includes(bucket)) {
    res.status(400).json({ error: 'Invalid bucket' });
    return;
  }

  const bucketPath = join(UPLOAD_DIR, bucket);
  
  try {
    const files = readdirSync(bucketPath).map((filename: string) => {
      const filePath = join(bucketPath, filename);
      const stats = statSync(filePath);
      return {
        name: filename,
        size: stats.size,
        created: stats.birthtime,
        url: `/api/storage/${bucket}/${filename}`
      };
    });
    
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list files' });
  }
});

export default router;
