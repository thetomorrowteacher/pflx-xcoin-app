// Shared image compression utility for PFLX X-Coin app
// Resizes images to max dimensions and converts to JPEG to keep Supabase payloads small

/**
 * Compress an image file to a max-dimension JPEG base64 string.
 * Default: 200px max side, 0.8 JPEG quality.
 */
export function compressImage(
  file: File,
  maxSize = 200,
  quality = 0.8,
): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width,
          h = img.height;
        if (w > h) {
          h = Math.round((h * maxSize) / w);
          w = maxSize;
        } else {
          w = Math.round((w * maxSize) / h);
          h = maxSize;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } else {
          // Fallback: return raw base64
          resolve(reader.result as string);
        }
      };
      img.onerror = () => resolve(reader.result as string);
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Compress a banner/cover image — larger max size (600px).
 */
export function compressBannerImage(file: File): Promise<string> {
  return compressImage(file, 600, 0.8);
}

/**
 * Recompress an existing base64 image string to a smaller JPEG.
 * Used to migrate old uncompressed PNGs stored in Supabase.
 * Returns the original string if already small enough or on error.
 */
export function recompressBase64(
  base64: string,
  maxSize = 200,
  quality = 0.7,
): Promise<string> {
  return new Promise((resolve) => {
    // Skip if already a small JPEG (under 20KB)
    if (base64.startsWith("data:image/jpeg") && base64.length < 20_000) {
      resolve(base64);
      return;
    }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width,
        h = img.height;
      if (w > h) {
        h = Math.round((h * maxSize) / w);
        w = maxSize;
      } else {
        w = Math.round((w * maxSize) / h);
        h = maxSize;
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } else {
        resolve(base64);
      }
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}
