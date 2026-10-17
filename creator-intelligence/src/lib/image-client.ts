// Browser-only helpers for preparing screenshots before upload.
import { localToUtc } from './parse';

export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Best-effort capture date from the file's own metadata (XMP or EXIF text inside PNG/JPEG).
 * Returns a UTC ISO string, or null. Always shown to the user for confirmation.
 */
export function readCaptureDate(buffer: ArrayBuffer): string | null {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 512 * 1024));
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const xmp = text.match(/(?:DateCreated|DateTimeOriginal)[^0-9]{1,4}(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?/);
  let iso: string | null = null;
  if (xmp) {
    const [, y, mo, d, h, mi, tz] = xmp;
    iso = tz ? new Date(`${y}-${mo}-${d}T${h}:${mi}:00${tz === 'Z' ? 'Z' : tz.length === 5 ? `${tz.slice(0, 3)}:${tz.slice(3)}` : tz}`).toISOString() : localToUtc(`${y}-${mo}-${d}`, `${h}:${mi}`).toISOString();
  } else {
    const exif = text.match(/(20\d{2}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):\d{2}/);
    if (exif) {
      const [, y, mo, d, h, mi] = exif;
      iso = localToUtc(`${y}-${mo}-${d}`, `${h}:${mi}`).toISOString();
    }
  }
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t) || t > Date.now() + 86_400_000 || t < Date.parse('2016-01-01')) return null;
  return iso;
}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if ('createImageBitmap' in window) {
    try {
      const bmp = await createImageBitmap(file);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // fall through to <img>, which can decode formats like HEIC in Safari
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('This file could not be read as an image.');
  }
}

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
}

/** Resizes to at most `maxEdge` px on the long side and re-encodes as JPEG (keeps small PNG/JPEG as-is). */
export async function prepareImage(file: File, maxEdge = 1800): Promise<PreparedImage> {
  const img = await decode(file);
  try {
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const keep = scale === 1 && (file.type === 'image/png' || file.type === 'image/jpeg') && file.size < 3.5 * 1024 * 1024;
    if (keep) return { blob: file, width: img.width, height: img.height };
    const width = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing is not available in this browser.');
    ctx.drawImage(img.source, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) throw new Error('Could not process the image.');
    return { blob, width, height };
  } finally {
    img.close();
  }
}

/** Crops a normalised box out of a loaded image into a small JPEG data URL (for thumbnails). */
export function cropThumbnail(img: HTMLImageElement, box: { x: number; y: number; width: number; height: number }, targetWidth = 90): string | null {
  const sx = box.x * img.naturalWidth;
  const sy = box.y * img.naturalHeight;
  const sw = box.width * img.naturalWidth;
  const sh = box.height * img.naturalHeight;
  if (sw < 8 || sh < 8) return null;
  const scale = targetWidth / sw;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL('image/jpeg', 0.72);
  return url.length < 60_000 ? url : null;
}
