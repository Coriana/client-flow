import { Router, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { join, extname, dirname } from 'path';
import { existsSync, mkdirSync, unlinkSync, readFileSync, writeFileSync } from 'fs';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Configure storage
const UPLOAD_DIR = process.env.UPLOAD_DIR || join(process.cwd(), 'server', 'uploads');

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
    const bucket = req.params.bucket;
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
  const { bucket } = req.params;
  
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

  // Ensure the directory exists
  const fullDir = join(UPLOAD_DIR, bucket, dirname(filePath));
  if (!existsSync(fullDir)) {
    mkdirSync(fullDir, { recursive: true });
  }

  // Write the file
  const fullPath = join(UPLOAD_DIR, bucket, filePath);
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
  const { bucket, filename } = req.params;
  
  if (!buckets.includes(bucket)) {
    res.status(400).json({ error: 'Invalid bucket' });
    return;
  }

  // Decode the filename in case it was URL encoded
  const decodedFilename = decodeURIComponent(filename);
  const filePath = join(UPLOAD_DIR, bucket, decodedFilename);
  
  if (!existsSync(filePath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  res.sendFile(filePath);
});

// Delete file from bucket
router.delete('/:bucket/:filename', authMiddleware, (req: AuthRequest, res: Response) => {
  const { bucket, filename } = req.params;
  
  if (!buckets.includes(bucket)) {
    res.status(400).json({ error: 'Invalid bucket' });
    return;
  }

  // Decode the filename in case it was URL encoded
  const decodedFilename = decodeURIComponent(filename);
  const filePath = join(UPLOAD_DIR, bucket, decodedFilename);
  
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
  const { bucket } = req.params;
  
  if (!buckets.includes(bucket)) {
    res.status(400).json({ error: 'Invalid bucket' });
    return;
  }

  const { readdirSync, statSync } = require('fs');
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
