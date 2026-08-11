/**
 * Uploads directory — persistent on Railway (Volume at /app/data),
 * falls back to public/uploads for local dev.
 */
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const PUBLIC_UPLOADS = path.join(__dirname, '..', 'public', 'uploads');

/**
 * The directory runtime uploads should be stored in.
 * On Railway: /app/data/uploads  (persistent — survives redeploys)
 * Locally:   <project>/data/uploads (also persistent, not in git)
 */
function uploadsDir() {
  const dir = process.env.UPLOAD_DIR || path.join(DATA_DIR, 'uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Where git-tracked assets (PWA icons) live. Served at /uploads/<filename>. */
function staticUploadsDir() {
  if (!fs.existsSync(PUBLIC_UPLOADS)) fs.mkdirSync(PUBLIC_UPLOADS, { recursive: true });
  return PUBLIC_UPLOADS;
}

/** Resolve any /uploads/<filename> URL to a real disk path. */
function resolveUpload(filename) {
  if (!filename) return null;
  const safe = path.basename(filename); // prevent path traversal
  // 1. Persistent uploads (runtime)
  const p1 = path.join(uploadsDir(), safe);
  if (fs.existsSync(p1)) return p1;
  // 2. Static uploads (PWA icons, git-tracked)
  const p2 = path.join(staticUploadsDir(), safe);
  if (fs.existsSync(p2)) return p2;
  return null;
}

/** Build a public /uploads/... URL from a stored image path or URL. */
function publicUrl(stored) {
  if (!stored) return '';
  if (/^https?:\/\//i.test(stored)) return stored; // external URL
  if (stored.startsWith('/uploads/')) return stored;
  return '/uploads/' + path.basename(stored);
}

module.exports = { uploadsDir, staticUploadsDir, resolveUpload, publicUrl };
