/**
 * Image uploads.
 *
 * - With Cloudinary credentials (free plan is enough): images go to Cloudinary and are
 *   delivered with automatic format/quality optimisation (f_auto,q_auto).
 * - Without Cloudinary: images are stored on the API server's disk in /uploads and served
 *   statically. Zero cost and zero accounts. Note that some free hosts (e.g. Render free web
 *   services) have ephemeral disks, so use Cloudinary's free plan there.
 *
 * Either way: memory-buffered multer, size/count limits, MIME allow-list and magic-byte checks.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const { env } = require('../config/env');
const ApiError = require('../utils/ApiError');

const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');

const ALLOWED = new Map([
  ['image/jpeg', { sig: [0xff, 0xd8, 0xff], ext: 'jpg' }],
  ['image/png', { sig: [0x89, 0x50, 0x4e, 0x47], ext: 'png' }],
  ['image/webp', { sig: null, ext: 'webp' }], // "RIFF....WEBP", checked below
  ['image/avif', { sig: null, ext: 'avif' }], // ISO-BMFF "ftyp" box, checked below
]);

const MAX_SIZE = 5 * 1024 * 1024;

/** Verifies the file's magic bytes match its declared MIME type (extensions are never trusted). */
function hasValidSignature(file) {
  const b = file.buffer;
  if (!b || b.length < 12) return false;
  if (file.mimetype === 'image/webp') return b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP';
  if (file.mimetype === 'image/avif') return b.slice(4, 8).toString('ascii') === 'ftyp';
  const entry = ALLOWED.get(file.mimetype);
  return Boolean(entry?.sig) && entry.sig.every((byte, i) => b[i] === byte);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE, files: 8 },
  fileFilter(req, file, cb) {
    if (!ALLOWED.has(file.mimetype)) return cb(ApiError.badRequest('Only JPG, PNG, WEBP or AVIF images are allowed'));
    cb(null, true);
  },
});

const usingCloudinary = () => env.features.uploads();

/** Folder names are server-chosen, but sanitise anyway so a path can never escape UPLOAD_ROOT. */
const safeFolder = (subfolder) =>
  String(subfolder)
    .split('/')
    .map((s) => s.replace(/[^a-zA-Z0-9_-]/g, ''))
    .filter(Boolean)
    .join('/');

async function saveLocally(file, subfolder) {
  const folder = safeFolder(subfolder);
  const dir = path.join(UPLOAD_ROOT, folder);
  await fs.promises.mkdir(dir, { recursive: true });
  const name = `${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}.${ALLOWED.get(file.mimetype).ext}`;
  await fs.promises.writeFile(path.join(dir, name), file.buffer);
  const rel = `${folder}/${name}`;
  return { url: `${env.publicApiUrl}/uploads/${rel}`, publicId: `local:${rel}` };
}

function saveToCloudinary(file, subfolder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${env.cloudinary.folder}/${subfolder}`,
        resource_type: 'image',
        transformation: [{ width: 2000, height: 2000, crop: 'limit' }],
      },
      (err, result) => {
        if (err) return reject(new ApiError(502, 'Image upload failed. Please try again.'));
        // f_auto,q_auto serves WebP/AVIF at an optimal quality to each browser.
        resolve({ url: result.secure_url.replace('/upload/', '/upload/f_auto,q_auto/'), publicId: result.public_id });
      },
    );
    stream.end(file.buffer);
  });
}

/** Validates and stores an in-memory upload. Returns { url, publicId }. */
async function uploadBuffer(file, subfolder) {
  if (!hasValidSignature(file)) throw ApiError.badRequest('The uploaded file is not a valid image');
  return usingCloudinary() ? saveToCloudinary(file, subfolder) : saveLocally(file, subfolder);
}

async function deleteImage(publicId) {
  if (!publicId) return;
  try {
    if (publicId.startsWith('local:')) {
      const target = path.resolve(UPLOAD_ROOT, publicId.slice(6));
      if (target.startsWith(UPLOAD_ROOT + path.sep)) await fs.promises.unlink(target);
    } else if (usingCloudinary()) {
      await cloudinary.uploader.destroy(publicId);
    }
  } catch {
    /* an orphaned image is not worth failing the request for */
  }
}

module.exports = { upload, uploadBuffer, deleteImage, UPLOAD_ROOT, usingCloudinary };
