// Prepare a bill photo / PDF for storage. Photos are downscaled and re-encoded
// as JPEG so a 5 MB phone photo becomes ~150–300 KB.

export const MAX_INPUT_BYTES = 20 * 1024 * 1024;
export const MAX_PDF_BYTES = 5 * 1024 * 1024;

/**
 * Pure validation of a picked file.
 * @param {{ type: string, size: number }} file
 * @returns {string|null} error message
 */
export function validateBillFile(file) {
  if (!file) return 'No file selected.';
  const isImage = file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf';
  if (!isImage && !isPdf) return 'Please choose a photo or a PDF.';
  if (isPdf && file.size > MAX_PDF_BYTES) return 'PDF is too large (max 5 MB).';
  if (file.size > MAX_INPUT_BYTES) return 'File is too large (max 20 MB).';
  return null;
}

/**
 * @param {File} file
 * @returns {Promise<Blob>}
 */
export async function prepareBillFile(file, maxDim = 1600, quality = 0.75) {
  if (file.type === 'application/pdf') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; // JPEG has no transparency
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size < file.size) return blob;
    return file;
  } catch {
    // Format the browser can't decode (e.g. some HEIC): keep the original if reasonably small.
    if (file.size <= MAX_PDF_BYTES) return file;
    throw new Error('This image format is not supported. Try a JPG or PNG.');
  }
}

/**
 * Centre-crop a picked photo to a small square JPEG data URL (~8–15 KB),
 * small enough to store inline with the person.
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function photoToDataUrl(file, size = 192, quality = 0.82) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Please choose a photo.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('That photo is too large (max 20 MB).');
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('This photo format isn’t supported. Try a JPG or PNG.');
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', quality);
}

// ── Payment QR images ──────────────────────────────────────────────────────

export const QR_MAX_SIDE = 720;
/** JPEG quality for QR images: still scans reliably, ~3x smaller than 0.92. */
export const QR_QUALITY = 0.8;

/**
 * Pure: scale (w, h) so the longer side is ≤ max. Aspect preserved, never
 * upscales, each side at least 1.
 * @returns {{ w: number, h: number }}
 */
export function fitWithin(w, h, max = QR_MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

/** Error with a machine-readable code: 'type' | 'size' | 'decode'. */
export class QrError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'QrError';
    this.code = code;
  }
}

/**
 * Downscale a picked QR image to a JPEG data URL (longer side ≤ max).
 * Checks run in order: type → size → decode.
 * @param {File} file
 * @returns {Promise<string>} JPEG data URL
 */
export async function qrToDataUrl(file, max = QR_MAX_SIDE, quality = QR_QUALITY) {
  if (!file?.type?.startsWith('image/')) {
    throw new QrError('type', 'That file isn’t an image. Choose a PNG or JPG.');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new QrError('size', 'That image is too large (max 20 MB).');
  }
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new QrError('decode', 'We couldn’t read that image. Try a screenshot.');
  }
  const { w, h } = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // JPEG has no transparency
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', quality);
}
