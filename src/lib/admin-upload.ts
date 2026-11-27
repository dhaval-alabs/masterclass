// Admin file upload (POST /api/upload), shared by every upload button in the admin.
//
// Vercel refuses any request body over 4.5 MB before our route runs, answering
// 413 "Request Entity Too Large" as plain text. The buttons used to parse that
// as JSON, fail, and show only "Error uploading image." So a large photo is
// shrunk in the browser first, and every refusal gets a message that says what
// happened.
//
// A shrunk image keeps its format (PNG stays PNG, so transparency and
// WhatsApp's JPEG/PNG rule still hold) and its shape; only the pixel size and,
// for JPEG/WebP, the quality go down.

const VERCEL_BODY_LIMIT = 4.5 * 1024 * 1024;
// Headroom under the cap for the multipart wrapper around the file.
const TARGET_BYTES = 4 * 1024 * 1024;
const SHRINKABLE = /^image\/(jpeg|png|webp)$/;

const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

/** The file as is when it already fits; otherwise a smaller copy, or the original if it can't be shrunk. */
export async function shrinkImageIfNeeded(file: File, maxBytes = TARGET_BYTES): Promise<File> {
  if (file.size <= maxBytes || !SHRINKABLE.test(file.type) || typeof createImageBitmap !== 'function') return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  try {
    const quality = file.type === 'image/png' ? undefined : 0.85;
    let scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 8; attempt++) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, file.type, quality));
      if (blob && blob.size <= maxBytes) return new File([blob], file.name, { type: file.type, lastModified: Date.now() });
      scale *= 0.8;
    }
    return file;
  } finally {
    bitmap.close();
  }
}

/** Uploads one file and returns its public URL. Throws an Error whose message can be shown as is. */
export async function uploadAdminFile(file: File): Promise<string> {
  const toSend = await shrinkImageIfNeeded(file);
  if (toSend.size > VERCEL_BODY_LIMIT) {
    throw new Error(`This file is ${mb(toSend.size)} MB and the upload limit is 4.5 MB. Use a smaller file.`);
  }
  const fd = new FormData();
  fd.append('file', toSend);
  const res = await fetch('/api/upload', { method: 'POST', body: fd });
  if (res.status === 401) throw new Error('Your admin login has expired. Log in again in a new tab, then upload again.');
  if (res.status === 413) throw new Error('This file is too large to upload (limit 4.5 MB). Use a smaller file.');
  const data = await res.json().catch(() => ({} as { url?: string; error?: string }));
  if (!res.ok || !data.url) throw new Error(data.error || `Upload failed (HTTP ${res.status}).`);
  return data.url;
}
