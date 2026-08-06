/** Client-side image helpers for Spark (no Firebase Storage). */

const MAX_EDGE = 1600;
const TARGET_BYTES = 350 * 1024;
const HARD_MAX_BYTES = 450 * 1024;

/**
 * Load a local image file and return a JPEG/PNG/WebP data URL small enough
 * to embed in a Firestore session document (≤ ~1MB total doc size).
 * Typical phone photos are resized + re-encoded automatically.
 */
export async function fileToEmbeddedImageDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file');
  }
  // Tiny files that already fit: keep original (preserves PNG transparency when small).
  if (file.size <= TARGET_BYTES && file.size <= HARD_MAX_BYTES) {
    return readAsDataUrl(file);
  }

  const bitmap = await loadImageBitmap(file);
  try {
    let { width, height } = bitmap;
    const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process image');
    ctx.drawImage(bitmap, 0, 0, width, height);

    let quality = 0.82;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (approxBytes(dataUrl) > TARGET_BYTES && quality > 0.45) {
      quality -= 0.08;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    // Still too big — shrink dimensions once more.
    if (approxBytes(dataUrl) > HARD_MAX_BYTES) {
      const shrink = Math.sqrt(TARGET_BYTES / approxBytes(dataUrl));
      const w2 = Math.max(1, Math.round(width * Math.min(1, shrink)));
      const h2 = Math.max(1, Math.round(height * Math.min(1, shrink)));
      canvas.width = w2;
      canvas.height = h2;
      ctx.drawImage(bitmap, 0, 0, w2, h2);
      dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    }

    if (approxBytes(dataUrl) > HARD_MAX_BYTES) {
      throw new Error('Image is still too large after compression. Try a smaller photo or a public image URL.');
    }
    return dataUrl;
  } finally {
    bitmap.close?.();
  }
}

/** Safe CSS background-image value for http(s) or data URLs. */
export function cssBackgroundImage(url: string): string | null {
  const u = String(url || '').trim();
  if (!u) return null;
  const escaped = u.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `url("${escaped}")`;
}

function approxBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.readAsDataURL(file);
  });
}

async function loadImageBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }
  // Rare legacy path: decode via <img>, then draw to an ImageBitmap-like canvas source.
  const dataUrl = await readAsDataUrl(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Could not decode image'));
    el.src = dataUrl;
  });
  // Polyfill minimal ImageBitmap surface used by the compress path.
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process image');
  ctx.drawImage(img, 0, 0);
  const fake = canvas as unknown as ImageBitmap & { width: number; height: number; close?: () => void };
  Object.defineProperty(fake, 'width', { value: canvas.width });
  Object.defineProperty(fake, 'height', { value: canvas.height });
  fake.close = () => undefined;
  return fake;
}
